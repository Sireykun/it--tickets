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
  organizationSchema,
  slaSchema,
  teamSchema,
} from "@/server/validation";
import { TicketError } from "@/server/tickets";
import { audit } from "@/server/audit";
import { TEMPLATE_KEYS, type TemplateKey } from "@/server/email/templates";
import { matchCampus, matchOrganization } from "@/server/users";

// Admin settings: create/update only. Records are deactivated, not deleted, so ticket history stays intact.

// Shared settings (departments, teams, topics, SLAs, organizations, email) are superadmin-only.
function assertAdmin(actor: Pick<AppUser, "role">) {
  if (actor.role !== "SUPERADMIN") throw new TicketError("Not allowed.");
}

// Save a named settings record: audit it, and turn a unique-name collision into a friendly message.
async function friendly<T extends { id: string; name: string }>(
  what: string,
  actor: AppUser,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const row = await fn();
    const type = what.replace(/\s+/g, "_").toLowerCase();
    await audit(prisma, actor, `${type}.save`, { type, id: row.id }, { name: row.name });
    return row;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TicketError(`A ${what} with that name already exists.`);
    }
    throw err;
  }
}

type UserInput = Omit<z.infer<typeof adminUserSchema>, "organizationId" | "campusId" | "staffCampusIds" | "manageCampusIds"> & {
  organizationId?: string | null; // "auto" = match by email domain
  campusId?: string | null; // home campus; "auto" = match by email domain
  staffCampusIds?: string[]; // campuses an agent/admin works at
  manageCampusIds?: string[]; // campuses where an ADMIN may manage users (superadmin only)
};

// Who a campus admin may edit: requesters/agents whose home campus or work campuses they manage.
function inReach(managed: string[], target: { role: string; campusId: string | null; staffCampuses: { campusId: string }[] }) {
  if (target.role !== "USER" && target.role !== "AGENT") return false;
  return (target.campusId !== null && managed.includes(target.campusId)) || target.staffCampuses.some((s) => managed.includes(s.campusId));
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

  const homeCampusId = (input.campusId ?? "auto") === "auto" ? await matchCampus(prisma, email) : (input.campusId ?? null);
  let staffCampusIds = input.role === "USER" || input.role === "SUPERADMIN" ? [] : [...new Set(input.staffCampusIds ?? [])];
  let manageCampusIds = input.role === "ADMIN" ? (input.manageCampusIds ?? []).filter((id) => staffCampusIds.includes(id)) : [];

  if (!superadmin) {
    const m = managed!;
    if (input.role !== "USER" && input.role !== "AGENT") throw new TicketError("Campus admins can only manage requesters and agents.");
    if (existing && !inReach(m, existing)) throw new TicketError("That user isn't at a campus you manage.");
    if (!homeCampusId || !m.includes(homeCampusId)) throw new TicketError("Choose a home campus you manage.");
    if (staffCampusIds.some((id) => !m.includes(id))) throw new TicketError("You can only add agents to campuses you manage.");
    if ((input.manageCampusIds ?? []).length > 0) throw new TicketError("Only a superadmin can grant permissions.");
    // Keep memberships at campuses this admin can't see or manage.
    const outside = (existing?.staffCampuses ?? []).map((s) => s.campusId).filter((id) => !m.includes(id));
    if (input.role === "AGENT") staffCampusIds = [...new Set([...staffCampusIds, ...outside])];
    manageCampusIds = [];
  }

  const organizationId = (input.organizationId ?? "auto") === "auto" ? await matchOrganization(prisma, email) : input.organizationId;
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  const data = {
    email,
    name: input.name,
    role: input.role,
    departmentId: input.departmentId,
    organizationId,
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

export async function saveDepartment(actor: AppUser, input: z.infer<typeof namedEntitySchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("department", actor, () =>
    id ? prisma.department.update({ where: { id }, data }) : prisma.department.create({ data }),
  );
}

export async function saveTeam(actor: AppUser, input: z.infer<typeof teamSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("team", actor, () => (id ? prisma.team.update({ where: { id }, data }) : prisma.team.create({ data })));
}

export async function saveSlaPolicy(actor: AppUser, input: z.infer<typeof slaSchema>) {
  assertAdmin(actor);
  if (input.resolutionTimeHours < input.responseTimeHours) {
    throw new TicketError("Resolution time can't be shorter than response time.");
  }
  const { id, ...data } = input;
  return friendly("SLA policy", actor, () =>
    id ? prisma.slaPolicy.update({ where: { id }, data }) : prisma.slaPolicy.create({ data }),
  );
}

export async function saveHelpTopic(actor: AppUser, input: z.infer<typeof helpTopicSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("help topic", actor, () =>
    id ? prisma.helpTopic.update({ where: { id }, data }) : prisma.helpTopic.create({ data }),
  );
}

export async function saveOrganization(actor: AppUser, input: z.infer<typeof organizationSchema>) {
  assertAdmin(actor);
  const { id, ...data } = input;
  return friendly("organization", actor, () =>
    id ? prisma.organization.update({ where: { id }, data }) : prisma.organization.create({ data }),
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
  return friendly("campus", actor, () => (id ? prisma.campus.update({ where: { id }, data }) : prisma.campus.create({ data })));
}
