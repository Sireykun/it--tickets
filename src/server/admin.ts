import bcrypt from "bcryptjs";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { AppUser } from "@/server/roles";
import { normalizeEmail } from "@/server/auth-rules";
import { prisma } from "@/server/prisma";
import type {
  adminUserSchema,
  campusSchema,
  emailTemplateSchema,
  helpTopicSchema,
  namedEntitySchema,
  slaSchema,
  teamSchema,
} from "@/server/validation";
import { ACTIVE_STATUSES, campusWhere, TicketError } from "@/server/tickets";
import { audit } from "@/server/audit";
import { TEMPLATE_KEYS, type TemplateKey } from "@/server/email/templates";
import { matchCampus } from "@/server/users";

// Admin settings: create/update only. Records are deactivated, not deleted, so ticket history stays intact.

// Shared settings (departments, teams, topics, SLAs, email) are superadmin-only.
function assertAdmin(actor: Pick<AppUser, "role">) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
}

// Save a named settings record: audit it, and turn a unique-name collision into a friendly message.
async function friendly<T extends { id: string; name: string }>(
  what: string,
  actor: AppUser,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await fn(tx);
      const type = what.replace(/\s+/g, "_").toLowerCase();
      await audit(tx, actor, `${type}.save`, { type, id: row.id }, { name: row.name });
      return row;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TicketError(`A ${what} with that name already exists.`);
    }
    throw err;
  }
}

type UserInput = Omit<z.infer<typeof adminUserSchema>, "campusId" | "staffCampusIds" | "manageCampusIds"> & {
  campusId?: string | null; // home campus; "auto" = match by email domain
  staffCampusIds?: string[]; // campuses an agent/admin works at
  manageCampusIds?: string[]; // campuses where an ADMIN may manage users (superadmin only)
};

// Who a campus admin may edit: requesters/agents whose home campus or work campuses they manage.
function inReach(managed: string[], target: { role: string; campusId: string | null; staffCampuses: { campusId: string }[] }) {
  if (target.role !== "USER" && target.role !== "AGENT") return false;
  return (target.campusId !== null && managed.includes(target.campusId)) || target.staffCampuses.some((s) => managed.includes(s.campusId));
}

function isFullyManaged(managed: string[], target: { campusId: string | null; staffCampuses: { campusId: string }[] }) {
  return (target.campusId === null || managed.includes(target.campusId)) && target.staffCampuses.every((s) => managed.includes(s.campusId));
}

export async function saveUser(actor: AppUser, input: UserInput) {
  const superadmin = actor.role === "SUPERADMIN";
  const managed = actor.manageCampusIds === "all" ? null : actor.manageCampusIds;
  if (!superadmin && (!managed || managed.length === 0)) throw new TicketError("Not allowed.");

  const email = normalizeEmail(input.email);
  const existing = input.id
    ? await prisma.user.findUnique({ where: { id: input.id }, include: { staffCampuses: true } })
    : null;
  if (input.id && !existing) throw new TicketError("User not found.");

  if (input.id === actor.id && (input.role !== actor.role || !input.isActive)) {
    throw new TicketError("You can't change your own role or deactivate yourself.");
  }
  if (input.role === "USER" && input.teamIds.length > 0) {
    throw new TicketError("Only agents and admins can be team members.");
  }

  // Only an omitted or "auto" campus is matched by email domain; null means no home campus.
  const homeCampusId = input.campusId === undefined || input.campusId === "auto" ? await matchCampus(prisma, email) : (input.campusId ?? null);
  let staffCampusIds = input.role === "USER" || input.role === "SUPERADMIN" ? [] : [...new Set(input.staffCampusIds ?? [])];
  let manageCampusIds = input.role === "ADMIN" ? (input.manageCampusIds ?? []).filter((id) => staffCampusIds.includes(id)) : [];

  if (!superadmin) {
    const m = managed!;
    if (input.role !== "USER" && input.role !== "AGENT") throw new TicketError("Campus admins can only manage requesters and agents.");
    if (existing && !inReach(m, existing)) throw new TicketError("That user isn't at a campus you manage.");
    // Someone who also belongs to another campus could be signed into or locked out of it
    // through their login details, so only their memberships here may change.
    const isShared = existing !== null && !isFullyManaged(m, existing);
    if (isShared) {
      const isLoginChange =
        email !== existing.email || Boolean(input.password) || input.role !== existing.role || input.isActive !== existing.isActive;
      if (isLoginChange) throw new TicketError("This person also belongs to another campus. Ask a superadmin to change their sign-in, role or status.");
      if (homeCampusId !== existing.campusId) throw new TicketError("Only a superadmin can move this person's home campus.");
    } else if (!homeCampusId || !m.includes(homeCampusId)) {
      throw new TicketError("Choose a home campus you manage.");
    }
    if (staffCampusIds.some((id) => !m.includes(id))) throw new TicketError("You can only add agents to campuses you manage.");
    if ((input.manageCampusIds ?? []).length > 0) throw new TicketError("Only a superadmin can grant permissions.");
    // Keep memberships at campuses this admin can't see or manage.
    const outside = (existing?.staffCampuses ?? []).map((s) => s.campusId).filter((id) => !m.includes(id));
    if (input.role === "AGENT") staffCampusIds = [...new Set([...staffCampusIds, ...outside])];
    manageCampusIds = [];
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  const data = {
    email,
    name: input.name,
    role: input.role,
    departmentId: input.departmentId,
    campusId: homeCampusId,
    isActive: input.isActive,
    ...(passwordHash ? { passwordHash } : {}),
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const user = input.id
        ? await tx.user.update({ where: { id: input.id }, data })
        : await tx.user.create({ data });

      await tx.staffCampus.deleteMany({ where: { userId: user.id, campusId: { notIn: staffCampusIds } } });
      for (const campusId of staffCampusIds) {
        // A campus admin's save never changes permissions it can't grant.
        const permissions = superadmin ? (manageCampusIds.includes(campusId) ? ["users.manage"] : []) : undefined;
        await tx.staffCampus.upsert({
          where: { userId_campusId: { userId: user.id, campusId } },
          update: permissions ? { permissions } : {},
          create: { userId: user.id, campusId, permissions: permissions ?? [] },
        });
      }
      // Open tickets assigned to someone who no longer works their campus go back to the queue.
      if (input.role !== "SUPERADMIN") {
        await tx.ticket.updateMany({
          where: {
            assignedAgentId: user.id,
            status: { not: "CLOSED" },
            ...(input.role === "USER" || !input.isActive ? {} : { OR: [{ campusId: null }, { campusId: { notIn: staffCampusIds } }] }),
          },
          data: { assignedAgentId: null },
        });
      }
      await tx.teamMember.deleteMany({ where: { userId: user.id, teamId: { notIn: input.teamIds } } });
      for (const teamId of input.teamIds) {
        await tx.teamMember.upsert({
          where: { teamId_userId: { teamId, userId: user.id } },
          update: {},
          create: { teamId, userId: user.id },
        });
      }
      // Never log the password itself, only that it changed.
      await audit(tx, actor, "user.save", { type: "user", id: user.id }, {
        email,
        role: input.role,
        isActive: input.isActive,
        teamIds: input.teamIds,
        campusId: homeCampusId,
        staffCampusIds,
        manageCampusIds,
        passwordChanged: Boolean(passwordHash),
      });
      return user;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TicketError("A user with that email already exists.");
    }
    throw err;
  }
}

export const USER_BULK_LIMIT = 50;

export type UserBulkChange =
  | { homeCampusId: string | null }
  | { addCampusId: string }
  | { removeCampusId: string }
  | { isActive: boolean };

// Applies one change to many users through `saveUser`, so each gets the same checks,
// ticket unassignment and audit row as a single edit.
export async function bulkUpdateUsers(actor: AppUser, userIds: string[], change: UserBulkChange) {
  assertAdmin(actor);
  const ids = [...new Set(userIds)];
  if (ids.length === 0) throw new TicketError("Select at least one user.");
  if (ids.length > USER_BULK_LIMIT) throw new TicketError(`Select at most ${USER_BULK_LIMIT} users at a time.`);

  let updated = 0;
  const skipped: { name: string; reason: string }[] = [];
  for (const id of ids) {
    const row = await findUserForEdit(id);
    try {
      if (!row) throw new TicketError("User not found.");
      const input = toUserInput(row);
      if ("homeCampusId" in change) input.campusId = change.homeCampusId;
      else if ("isActive" in change) input.isActive = change.isActive;
      else {
        if (row.role !== "AGENT" && row.role !== "ADMIN") throw new TicketError("Only agents and campus admins work at campuses.");
        if ("addCampusId" in change) input.staffCampusIds.push(change.addCampusId);
        else {
          input.staffCampusIds = input.staffCampusIds.filter((c) => c !== change.removeCampusId);
          input.manageCampusIds = input.manageCampusIds.filter((c) => c !== change.removeCampusId);
        }
      }
      await saveUser(actor, input);
      updated++;
    } catch (err) {
      if (!(err instanceof TicketError)) throw err;
      skipped.push({ name: row?.name ?? id, reason: err.message });
    }
  }
  return { updated, skipped };
}

// From a campus's page: staff start working there; a requester gets it as their home campus.
export async function addToCampus(actor: AppUser, campusId: string, userId: string, opts: { canManageUsers: boolean }) {
  assertAdmin(actor);
  const campus = await prisma.campus.findUnique({ where: { id: campusId } });
  if (!campus?.isActive) throw new TicketError("Choose an active campus.");
  const row = await findUserForEdit(userId);
  if (!row) throw new TicketError("User not found.");
  if (row.role === "SUPERADMIN") throw new TicketError("Superadmins already work at every campus.");
  const input = toUserInput(row);
  if (row.role === "USER") input.campusId = campusId;
  else {
    input.staffCampusIds.push(campusId);
    if (row.role === "ADMIN" && opts.canManageUsers) input.manageCampusIds.push(campusId);
  }
  return saveUser(actor, input);
}

export async function removeFromCampus(actor: AppUser, campusId: string, userId: string) {
  assertAdmin(actor);
  const row = await findUserForEdit(userId);
  if (!row) throw new TicketError("User not found.");
  const input = toUserInput(row);
  input.staffCampusIds = input.staffCampusIds.filter((c) => c !== campusId);
  input.manageCampusIds = input.manageCampusIds.filter((c) => c !== campusId);
  return saveUser(actor, input);
}

// The edit panel's side facts: open tickets and recent account changes. Null when the actor
// can't edit this user; tickets are limited to the actor's own campuses.
export async function getUserDetail(actor: AppUser, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, campusId: true, createdAt: true, lastLoginAt: true, staffCampuses: { select: { campusId: true } } },
  });
  if (!user) return null;
  if (actor.manageCampusIds !== "all" && !inReach(actor.manageCampusIds, user)) return null;

  const open = { status: { in: ACTIVE_STATUSES }, ...campusWhere(actor) };
  const ticketSelect = { ticketNumber: true, subject: true, status: true } as const;
  const requested = await prisma.ticket.findMany({ where: { ...open, requesterId: userId }, orderBy: { updatedAt: "desc" }, take: 10, select: ticketSelect });
  const assigned = await prisma.ticket.findMany({ where: { ...open, assignedAgentId: userId }, orderBy: { updatedAt: "desc" }, take: 10, select: ticketSelect });
  const history = await prisma.auditEvent.findMany({
    where: { entityType: "user", entityId: userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } },
  });
  return { createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, requested, assigned, history };
}

function findUserForEdit(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { staffCampuses: { select: { campusId: true, permissions: true } }, teamMemberships: { select: { teamId: true } } },
  });
}

// The user as currently saved, so a caller can change one field and pass it to `saveUser`.
function toUserInput(row: NonNullable<Awaited<ReturnType<typeof findUserForEdit>>>) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    departmentId: row.departmentId,
    campusId: row.campusId,
    isActive: row.isActive,
    password: null,
    teamIds: row.teamMemberships.map((m) => m.teamId),
    staffCampusIds: row.staffCampuses.map((s) => s.campusId),
    manageCampusIds: row.staffCampuses.filter((s) => s.permissions.includes("users.manage")).map((s) => s.campusId),
  } satisfies UserInput;
}

export async function saveDepartment(actor: AppUser, input: z.infer<typeof namedEntitySchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("department", actor, (tx) =>
    id ? tx.department.update({ where: { id }, data }) : tx.department.create({ data }),
  );
}

export async function saveTeam(actor: AppUser, input: z.infer<typeof teamSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("team", actor, (tx) => (id ? tx.team.update({ where: { id }, data }) : tx.team.create({ data })));
}

export async function saveSlaPolicy(actor: AppUser, input: z.infer<typeof slaSchema>) {
  assertAdmin(actor);
  if (input.resolutionTimeHours < input.responseTimeHours) {
    throw new TicketError("Resolution time can't be shorter than response time.");
  }
  const { id, ...data } = input;
  return friendly("SLA policy", actor, (tx) =>
    id ? tx.slaPolicy.update({ where: { id }, data }) : tx.slaPolicy.create({ data }),
  );
}

export async function saveHelpTopic(actor: AppUser, input: z.infer<typeof helpTopicSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("help topic", actor, (tx) =>
    id ? tx.helpTopic.update({ where: { id }, data }) : tx.helpTopic.create({ data }),
  );
}

// Overrides the built-in wording for one email. Deactivating a template stops that email entirely.
export async function saveEmailTemplate(actor: AppUser, input: z.infer<typeof emailTemplateSchema>) {
  assertAdmin(actor);
  if (!TEMPLATE_KEYS.includes(input.key as TemplateKey)) throw new TicketError("Unknown email template.");
  const { key, ...data } = input;
  await prisma.$transaction(async (tx) => {
    await tx.emailTemplate.upsert({ where: { key }, update: data, create: { key, ...data } });
    await audit(tx, actor, "email_template.save", { type: "email_template", id: key }, { isActive: data.isActive });
  });
}

export async function resetEmailTemplate(actor: AppUser, key: string) {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    await tx.emailTemplate.deleteMany({ where: { key } });
    await audit(tx, actor, "email_template.reset", { type: "email_template", id: key });
  });
}

export async function saveCampus(actor: AppUser, input: z.infer<typeof campusSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("campus", actor, (tx) => (id ? tx.campus.update({ where: { id }, data }) : tx.campus.create({ data })));
}
