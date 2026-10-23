import { Prisma } from "@/generated/prisma/client";
import type { ThreadEntryType, TicketPriority, TicketSource, TicketStatus } from "@/generated/prisma/enums";
import { PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { audit } from "@/server/audit";
import { notifyAssigned, notifyMessage, notifyRequesterStatus, notifyStatus, notifyTicketCreated } from "@/server/email/notify";
import { type AppUser, canViewTicket, canWorkTicket, hasFullQueue, inScope, isParticipant, isStaff } from "@/server/roles";
import { prisma } from "@/server/prisma";
import { campusForRequester, ensureUser } from "@/server/users";
import { computeDueDates } from "@/server/sla";
import { type PreparedFile, type StoredFile, withStoredFiles } from "@/server/storage";

export type Actor = Pick<AppUser, "id" | "name" | "role" | "campusScope">;

// Only tickets in the actor's campuses (no filter for superadmins).
export function campusWhere(actor: Pick<AppUser, "campusScope">): Prisma.TicketWhereInput {
  return actor.campusScope === "all" ? {} : { campusId: { in: actor.campusScope } };
}

// Staff who can be assigned tickets at `campusId`: its agents and campus admins, plus superadmins.
function assignableWhere(campusId: string | null): Prisma.UserWhereInput {
  return {
    isActive: true,
    OR: [
      { role: "SUPERADMIN" },
      { role: { in: ["AGENT", "ADMIN"] }, staffCampuses: campusId ? { some: { campusId } } : { none: {} } },
    ],
  };
}

// Errors safe to show to the user as-is.
export class TicketError extends Error {}

export const ACTIVE_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];
const WORKING_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS"];

type Tx = Prisma.TransactionClient;

function normalizeNumber(ticketNumber: string): string {
  return decodeURIComponent(ticketNumber).trim().toUpperCase();
}

function attachmentRows(stored: StoredFile[], uploadedById: string) {
  return stored.map((f) => ({
    fileName: f.fileName,
    mimeType: f.mimeType,
    sizeBytes: BigInt(f.sizeBytes),
    storageKey: f.storageKey,
    checksumSha256: f.checksumSha256,
    uploadedById,
  }));
}

function systemEvent(tx: Tx, ticketId: string, actor: Actor, body: string) {
  return tx.ticketThread.create({ data: { ticketId, authorId: actor.id, type: "SYSTEM_EVENT", body } });
}

// Timestamps that follow a status change.
function statusTimestamps(to: TicketStatus, current: { resolvedAt: Date | null }, now: Date) {
  switch (to) {
    case "RESOLVED":
      return { resolvedAt: now, closedAt: null };
    case "CLOSED":
      return { resolvedAt: current.resolvedAt ?? now, closedAt: now };
    default:
      return { resolvedAt: null, closedAt: null };
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

type CreateOptions = {
  // Staff opening a ticket for someone else (phone call, walk-in, …).
  requesterId?: string;
  source?: TicketSource;
  // People to CC from the start (e.g. other recipients of an inbound email).
  collaboratorIds?: string[];
  // Staff may file a ticket at another of their campuses; default is the requester's home campus.
  campusId?: string;
};

export async function createTicket(
  actor: Actor,
  input: { helpTopicId: string; subject: string; body: string; room?: string; priority?: TicketPriority },
  files: PreparedFile[] = [],
  opts: CreateOptions = {},
) {
  const onBehalf = opts.requesterId !== undefined && opts.requesterId !== actor.id;
  if (onBehalf && !isStaff(actor.role)) throw new TicketError("Not allowed.");
  const requesterId = opts.requesterId ?? actor.id;

  const topic = await prisma.helpTopic.findFirst({
    where: { id: input.helpTopicId, isActive: true },
    include: { slaPolicy: true },
  });
  if (!topic) throw new TicketError("Please choose a help topic.");

  const departmentId =
    topic.defaultDepartmentId ??
    (await prisma.department.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }))?.id;
  if (!departmentId) throw new TicketError("No department is set up to receive tickets yet. Please contact IT.");

  let campusId: string | null;
  if (opts.campusId) {
    const campus = await prisma.campus.findUnique({ where: { id: opts.campusId }, select: { isActive: true } });
    if (!campus?.isActive) throw new TicketError("Please choose an active campus.");
    if (isStaff(actor.role) && !inScope(actor.campusScope, opts.campusId)) throw new TicketError("You can't file tickets at that campus.");
    campusId = opts.campusId;
  } else {
    const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterId }, select: { campusId: true, email: true } });
    campusId = await campusForRequester(prisma, requester);
    // Staff filing for someone from another campus keep the ticket where they can work it.
    if (onBehalf && actor.campusScope !== "all" && !inScope(actor.campusScope, campusId)) campusId = actor.campusScope[0] ?? null;
  }

  const now = new Date();
  const sla = topic.slaPolicy?.isActive ? topic.slaPolicy : null;

  return withStoredFiles(files, (stored) =>
    prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject: input.subject,
          room: input.room?.trim() || null,
          campusId,
          source: opts.source ?? "WEB",
          priority: input.priority ?? topic.defaultPriority,
          requesterId,
          createdById: actor.id,
          departmentId,
          helpTopicId: topic.id,
          assignedTeamId: topic.defaultTeamId,
          slaPolicyId: sla?.id ?? null,
          ...computeDueDates(sla, now),
          createdAt: now,
        },
      });
      // The description is the requester's words even when an agent typed it in.
      await tx.ticketThread.create({
        data: {
          ticketId: ticket.id,
          authorId: requesterId,
          type: "CLIENT_MESSAGE",
          body: input.body,
          createdAt: now,
          attachments: { create: attachmentRows(stored, actor.id) },
        },
      });
      if (onBehalf) {
        await systemEvent(tx, ticket.id, actor, `Opened on behalf of the requester (${SOURCE_LABEL[ticket.source]})`);
      }
      const ccIds = [...new Set(opts.collaboratorIds ?? [])].filter((id) => id !== requesterId);
      if (ccIds.length > 0) {
        await tx.ticketCollaborator.createMany({ data: ccIds.map((userId) => ({ ticketId: ticket.id, userId, addedById: actor.id })) });
      }
      await audit(tx, actor, "ticket.create", { type: "ticket", id: ticket.id }, { ticketNumber: ticket.ticketNumber, source: ticket.source });
      await notifyTicketCreated(tx, ticket.id, actor.id, input.body);
      return ticket;
    }),
  );
}

// Staff opening a ticket for someone: reuse their account, or create a requester account
// (no password; they can sign in with Google or get one from IT later).
export async function findOrCreateRequester(actor: Actor, input: { email: string; name?: string | null }) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const existing = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (existing) {
    if (!existing.isActive) throw new TicketError("That user's account is deactivated.");
    return existing;
  }
  if (!input.name?.trim()) throw new TicketError("This email is new. Enter the person's name to create their account.");
  return (await ensureUser(input, { actorId: actor.id, via: "ticket" })).user;
}

// ─── CC / collaborators ─────────────────────────────────────────────────────

const ALLOWED_DOMAIN = () => (process.env.ALLOWED_EMAIL_DOMAIN ?? "ciaschool.edu.kh").toLowerCase();

// Staff can CC anyone; requesters can CC people at the school's email domain.
export async function addCollaborator(actor: Actor, ticketNumber: string, input: { email: string; name?: string | null }) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: normalizeNumber(ticketNumber) },
    include: { collaborators: { select: { userId: true } } },
  });
  if (!ticket || !canViewTicket(actor, ticket)) throw new TicketError("Ticket not found.");
  const asStaff = canWorkTicket(actor, ticket);
  if (!asStaff && ticket.requesterId !== actor.id) throw new TicketError("Only the requester can add people.");
  if (ticket.status === "CLOSED") throw new TicketError("This ticket is closed.");

  const email = input.email.trim().toLowerCase();
  if (!asStaff && !email.endsWith(`@${ALLOWED_DOMAIN()}`)) {
    throw new TicketError(`You can only add people with an @${ALLOWED_DOMAIN()} email.`);
  }
  const { user } = await ensureUser({ email, name: input.name }, { actorId: actor.id, via: "cc" });
  if (!user.isActive) throw new TicketError("That person's account is deactivated.");
  if (user.id === ticket.requesterId) throw new TicketError("They're already the requester.");
  if (ticket.collaborators.some((c) => c.userId === user.id)) throw new TicketError(`${user.name} is already CC'd.`);

  await prisma.$transaction(async (tx) => {
    await tx.ticketCollaborator.create({ data: { ticketId: ticket.id, userId: user.id, addedById: actor.id } });
    await systemEvent(tx, ticket.id, actor, `Added ${user.name} as CC`);
    await audit(tx, actor, "ticket.cc.add", { type: "ticket", id: ticket.id }, { userId: user.id });
  });
  return user;
}

// Staff and the requester can remove anyone; a CC can remove themselves.
export async function removeCollaborator(actor: Actor, ticketNumber: string, userId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: normalizeNumber(ticketNumber) } });
  if (!ticket) throw new TicketError("Ticket not found.");
  if (!canWorkTicket(actor, ticket) && ticket.requesterId !== actor.id && actor.id !== userId) throw new TicketError("Not allowed.");
  const row = await prisma.ticketCollaborator.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!row) return;
  await prisma.$transaction(async (tx) => {
    await tx.ticketCollaborator.delete({ where: { ticketId_userId: { ticketId: ticket.id, userId } } });
    await systemEvent(tx, ticket.id, actor, actor.id === userId ? `${row.user.name} left the CC list` : `Removed ${row.user.name} from CC`);
    await audit(tx, actor, "ticket.cc.remove", { type: "ticket", id: ticket.id }, { userId });
  });
}

// ─── Read ───────────────────────────────────────────────────────────────────

// Returns null when the ticket doesn't exist *or* the viewer may not see it,
// so callers can't tell the two apart (no ticket-number probing).
// `asRequester` lets staff preview exactly what the requester sees (no internal notes).
export async function getTicketForViewer(actor: Actor, ticketNumber: string, opts: { asRequester?: boolean } = {}) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: normalizeNumber(ticketNumber) },
    include: {
      campus: { select: { id: true, name: true } },
      requester: {
        select: { id: true, name: true, email: true, campus: { select: { name: true } } },
      },
      assignedAgent: { select: { id: true, name: true } },
      assignedTeam: { select: { id: true, name: true } },
      helpTopic: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      kudo: { select: { id: true, createdAt: true } },
      slaPolicy: { select: { name: true, responseTimeHours: true, resolutionTimeHours: true } },
      linksFrom: { include: { toTicket: { select: { ticketNumber: true, subject: true, status: true } } } },
      linksTo: { include: { fromTicket: { select: { ticketNumber: true, subject: true, status: true } } } },
      collaborators: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, email: true } } } },
      thread: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
        },
      },
    },
  });
  if (!ticket || !canViewTicket(actor, ticket)) return null;
  // Internal notes only for staff working this ticket's campus (not staff who are merely a participant).
  const staffView = canWorkTicket(actor, ticket) && !opts.asRequester;
  return staffView ? ticket : { ...ticket, thread: ticket.thread.filter((e) => e.type !== "INTERNAL_NOTE") };
}

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketForViewer>>>;

const lastConversationEntry = {
  where: { type: { in: ["CLIENT_MESSAGE", "AGENT_REPLY"] as ThreadEntryType[] } },
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { type: true, createdAt: true },
};

export async function listMyTickets(
  actor: Actor,
  filter: "open" | "closed",
  opts: { q?: string; sort?: "updated" | "newest" | "oldest" } = {},
) {
  const q = opts.q?.trim().slice(0, 100);
  return prisma.ticket.findMany({
    where: {
      OR: [{ requesterId: actor.id }, { collaborators: { some: { userId: actor.id } } }],
      status: filter === "open" ? { in: ACTIVE_STATUSES } : "CLOSED",
      ...(q && { AND: [{ OR: [{ ticketNumber: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }, { helpTopic: { name: { contains: q, mode: "insensitive" } } }] }] }),
    },
    orderBy: opts.sort === "newest" ? { createdAt: "desc" } : opts.sort === "oldest" ? { createdAt: "asc" } : { updatedAt: "desc" },
    take: 100,
    include: {
      helpTopic: { select: { name: true } },
      thread: lastConversationEntry,
    },
  });
}

// "personal" is the only view agents get: open tickets assigned to them or that they filed.
export const QUEUE_VIEWS = ["personal", "unassigned", "mine", "teams", "open", "overdue", "all"] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

export const QUEUE_SORTS = ["priority", "newest", "oldest", "updated"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export type QueueParams = {
  view: QueueView;
  status?: TicketStatus;
  priority?: TicketPriority;
  teamId?: string;
  topicId?: string;
  campusId?: string;
  q?: string;
  sort?: QueueSort; // defaults to "priority"
  page?: number;
  limit?: number; // defaults to QUEUE_PAGE_SIZE; CSV export asks for more
};

export const QUEUE_PAGE_SIZE = 50;

const QUEUE_ORDER: Record<QueueSort, Prisma.TicketOrderByWithRelationInput[]> = {
  priority: [{ priorityLevel: "desc" }, { resolutionDueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  updated: [{ updatedAt: "desc" }],
};

async function myTeamIds(actor: Actor): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({ where: { userId: actor.id }, select: { teamId: true } });
  return rows.map((r) => r.teamId);
}

function viewWhere(view: QueueView, actor: Actor, teamIds: string[], now: Date): Prisma.TicketWhereInput {
  const active = { status: { in: ACTIVE_STATUSES } };
  switch (view) {
    case "personal":
      return { ...active, OR: [{ assignedAgentId: actor.id }, { requesterId: actor.id }, { createdById: actor.id }] };
    case "unassigned":
      return { ...active, assignedAgentId: null };
    case "mine":
      return { ...active, assignedAgentId: actor.id };
    case "teams":
      return { ...active, assignedTeamId: { in: teamIds } };
    case "overdue":
      return {
        status: { in: WORKING_STATUSES },
        OR: [{ firstRespondedAt: null, firstResponseDueAt: { lt: now } }, { resolutionDueAt: { lt: now } }],
      };
    case "all":
      return {};
    default:
      return active;
  }
}

export async function listQueue(actor: Actor, params: QueueParams) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const now = new Date();
  // Agents can't reach the shared queues, even by editing the URL.
  const view: QueueView = hasFullQueue(actor.role) ? params.view : "personal";
  const teamIds = view === "teams" ? await myTeamIds(actor) : [];

  const filters: Prisma.TicketWhereInput[] = [campusWhere(actor), viewWhere(view, actor, teamIds, now)];
  if (params.campusId) filters.push({ campusId: params.campusId });
  if (params.status) filters.push({ status: params.status });
  if (params.priority) filters.push({ priority: params.priority });
  if (params.teamId) filters.push({ assignedTeamId: params.teamId });
  if (params.topicId) filters.push({ helpTopicId: params.topicId });
  const q = params.q?.trim();
  if (q) {
    filters.push({
      OR: [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { requester: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } },
      ],
    });
  }
  const where: Prisma.TicketWhereInput = { AND: filters };
  const page = Math.max(0, params.page ?? 0);

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: QUEUE_ORDER[params.sort ?? "priority"],
      skip: page * (params.limit ?? QUEUE_PAGE_SIZE),
      take: params.limit ?? QUEUE_PAGE_SIZE,
      include: {
        requester: { select: { name: true, email: true } },
        campus: { select: { name: true } },
        department: { select: { name: true } },
        assignedAgent: { select: { name: true } },
        assignedTeam: { select: { name: true } },
        helpTopic: { select: { name: true } },
        thread: lastConversationEntry,
      },
    }),
    prisma.ticket.count({ where }),
  ]);
  return { tickets, total, page, view };
}

export async function queueCounts(actor: Actor): Promise<Record<Exclude<QueueView, "all">, number>> {
  const now = new Date();
  const count = (view: QueueView, teamIds: string[] = []) =>
    prisma.ticket.count({ where: { AND: [campusWhere(actor), viewWhere(view, actor, teamIds, now)] } });
  // Agents only see the personal view, so skip counting queues they can't open.
  if (!hasFullQueue(actor.role)) {
    return { personal: await count("personal"), unassigned: 0, mine: 0, teams: 0, open: 0, overdue: 0 };
  }
  const teamIds = await myTeamIds(actor);
  const [personal, unassigned, mine, teams, open, overdue] = await Promise.all(
    (["personal", "unassigned", "mine", "teams", "open", "overdue"] as const).map((v) => count(v, teamIds)),
  );
  return { personal, unassigned, mine, teams, open, overdue };
}

// Options for staff forms. With a ticket's `campusId`, agents are those working there; without one
// (standalone tasks), agents at any campus the actor works at. Campuses are the actor's own.
export async function assignmentOptions(actor: Pick<AppUser, "campusScope">, campusId: string | null = null) {
  const agentWhere: Prisma.UserWhereInput = campusId
    ? assignableWhere(campusId)
    : {
        isActive: true,
        OR: [
          { role: "SUPERADMIN" },
          {
            role: { in: ["AGENT", "ADMIN"] },
            ...(actor.campusScope === "all" ? {} : { staffCampuses: { some: { campusId: { in: actor.campusScope } } } }),
          },
        ],
      };
  const [departments, teams, agents, campuses] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.team.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: agentWhere, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.campus.findMany({
      where: { isActive: true, ...(actor.campusScope === "all" ? {} : { id: { in: actor.campusScope } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { departments, teams, agents, campuses };
}

// ─── Messages ───────────────────────────────────────────────────────────────

export type MessageMode = "client" | "reply" | "note";

export async function addMessage(
  actor: Actor,
  ticketNumber: string,
  input: { body: string; mode: MessageMode; closeAfterReply?: boolean },
  files: PreparedFile[] = [],
) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: normalizeNumber(ticketNumber) },
    include: { collaborators: { select: { userId: true } } },
  });
  if (!ticket || !canViewTicket(actor, ticket)) throw new TicketError("Ticket not found.");

  // Requesters and CCs post client messages; staff of the ticket's campus post replies/notes.
  if (input.mode === "client" ? !isParticipant(actor.id, ticket) : !canWorkTicket(actor, ticket)) throw new TicketError("Not allowed.");
  if (input.closeAfterReply && input.mode !== "reply") throw new TicketError("A closure message must be a reply to the requester.");
  if (input.closeAfterReply && ticket.status === "CLOSED") throw new TicketError("This ticket is already closed.");
  if (input.mode === "client" && ticket.status === "CLOSED") {
    throw new TicketError("This ticket is closed. Please open a new ticket if you still need help.");
  }

  const type: ThreadEntryType =
    input.mode === "client" ? "CLIENT_MESSAGE" : input.mode === "reply" ? "AGENT_REPLY" : "INTERNAL_NOTE";
  const now = new Date();

  return withStoredFiles(files, (stored) =>
    prisma.$transaction(async (tx) => {
      const entry = await tx.ticketThread.create({
        data: {
          ticketId: ticket.id,
          authorId: actor.id,
          type,
          body: input.body,
          createdAt: now,
          attachments: { create: attachmentRows(stored, actor.id) },
        },
      });

      const data: Prisma.TicketUpdateInput = { updatedAt: now };
      if (type === "CLIENT_MESSAGE" && ticket.status === "RESOLVED") {
        Object.assign(data, { status: "OPEN", closedByStaff: false, ...statusTimestamps("OPEN", ticket, now) });
        await systemEvent(tx, ticket.id, actor, "Reopened by the requester's reply");
      }
      if (type === "AGENT_REPLY") {
        if (!ticket.firstRespondedAt) data.firstRespondedAt = now;
        if (input.closeAfterReply) {
          Object.assign(data, { status: "CLOSED", closedByStaff: true, ...statusTimestamps("CLOSED", ticket, now) });
          await systemEvent(tx, ticket.id, actor, `Status changed from ${STATUS_LABEL[ticket.status]} to Closed`);
        } else if (ticket.status === "OPEN") {
          data.status = "IN_PROGRESS";
          await systemEvent(tx, ticket.id, actor, `Status changed from Open to In progress`);
        }
      }
      await tx.ticket.update({ where: { id: ticket.id }, data });
      if (type !== "CLIENT_MESSAGE") {
        await audit(tx, actor, type === "AGENT_REPLY" ? "ticket.reply" : "ticket.note", { type: "ticket", id: ticket.id }, { entryId: entry.id });
      }
      if (input.closeAfterReply) await audit(tx, actor, "ticket.close", { type: "ticket", id: ticket.id }, { entryId: entry.id });
      await notifyMessage(tx, ticket.id, actor, type, input.body);
      return entry;
    }),
  );
}

// ─── Updates ────────────────────────────────────────────────────────────────

export async function closeAsRequester(actor: Actor, ticketNumber: string) {
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: normalizeNumber(ticketNumber) } });
  if (!ticket || ticket.requesterId !== actor.id) throw new TicketError("Ticket not found.");
  if (ticket.status === "CLOSED") return ticket;

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await systemEvent(tx, ticket.id, actor, "Closed by the requester");
    await audit(tx, actor, "ticket.close", { type: "ticket", id: ticket.id });
    const closed = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "CLOSED", closedByStaff: false, ...statusTimestamps("CLOSED", ticket, now) },
    });
    await notifyRequesterStatus(tx, ticket.id, actor, "CLOSED");
    return closed;
  });
}

export async function reopenAsRequester(actor: Actor, ticketNumber: string) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { ticketNumber: normalizeNumber(ticketNumber) } });
    if (!ticket || ticket.requesterId !== actor.id) throw new TicketError("Ticket not found.");
    if (ticket.status !== "CLOSED") return ticket;

    const now = new Date();
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "CLOSED" },
      data: { status: "OPEN", closedByStaff: false, updatedAt: now, ...statusTimestamps("OPEN", ticket, now) },
    });
    if (updated.count === 0) return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    await systemEvent(tx, ticket.id, actor, "Reopened by the requester");
    await audit(tx, actor, "ticket.reopen", { type: "ticket", id: ticket.id });
    await notifyRequesterStatus(tx, ticket.id, actor, "OPEN");
    return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  });
}

export async function giveKudo(actor: Actor, ticketNumber: string) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { ticketNumber: normalizeNumber(ticketNumber) } });
    if (!ticket || ticket.requesterId !== actor.id) throw new TicketError("Ticket not found.");
    if (ticket.status !== "CLOSED") throw new TicketError("Kudos are available on closed tickets.");
    const existing = await tx.ticketKudo.findUnique({ where: { ticketId: ticket.id } });
    if (existing) return existing;
    const kudo = await tx.ticketKudo.create({ data: { ticketId: ticket.id, requesterId: actor.id, recipientId: ticket.assignedAgentId } });
    await audit(tx, actor, "ticket.kudo", { type: "ticket", id: ticket.id });
    return kudo;
  });
}

export async function updateTicketFields(
  actor: Actor,
  ticketNumber: string,
  patch: {
    status: TicketStatus;
    priority: TicketPriority;
    assignedTeamId: string | null;
    assignedAgentId: string | null;
    departmentId?: string; // omitted = keep
    campusId?: string; // omitted = keep
  },
) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: normalizeNumber(ticketNumber) },
    include: {
      assignedAgent: { select: { name: true } },
      assignedTeam: { select: { name: true } },
      department: { select: { name: true } },
      campus: { select: { name: true } },
    },
  });
  if (!ticket || !canWorkTicket(actor, ticket)) throw new TicketError(isStaff(actor.role) ? "Ticket not found." : "Not allowed.");

  const events: string[] = [];
  const data: Prisma.TicketUncheckedUpdateInput = {};
  const now = new Date();

  // Campus first: the assignee check below is against the campus the ticket will end up at.
  let campusId = ticket.campusId;
  let agentId = patch.assignedAgentId;
  if (patch.campusId && patch.campusId !== ticket.campusId) {
    if (!inScope(actor.campusScope, patch.campusId)) throw new TicketError("You can't move tickets to that campus.");
    const campus = await prisma.campus.findFirst({ where: { id: patch.campusId, isActive: true } });
    if (!campus) throw new TicketError("That campus doesn't exist or is inactive.");
    campusId = campus.id;
    data.campusId = campus.id;
    events.push(`Moved from ${ticket.campus?.name ?? "no campus"} to ${campus.name}`);
    // An agent who doesn't work at the new campus can't keep the ticket.
    if (agentId && !(await prisma.user.count({ where: { id: agentId, ...assignableWhere(campusId) } }))) agentId = null;
  }

  if (patch.status !== ticket.status) {
    Object.assign(data, { status: patch.status, closedByStaff: patch.status === "CLOSED", ...statusTimestamps(patch.status, ticket, now) });
    events.push(`Status changed from ${STATUS_LABEL[ticket.status]} to ${STATUS_LABEL[patch.status]}`);
  }
  if (patch.priority !== ticket.priority) {
    data.priority = patch.priority;
    events.push(`Priority changed from ${PRIORITY_LABEL[ticket.priority]} to ${PRIORITY_LABEL[patch.priority]}`);
  }
  if (patch.assignedTeamId !== ticket.assignedTeamId) {
    const team = patch.assignedTeamId
      ? await prisma.team.findFirst({ where: { id: patch.assignedTeamId, isActive: true } })
      : null;
    if (patch.assignedTeamId && !team) throw new TicketError("That team doesn't exist or is inactive.");
    data.assignedTeamId = patch.assignedTeamId;
    events.push(team ? `Team set to ${team.name}` : `Removed from team ${ticket.assignedTeam?.name ?? ""}`.trim());
  }
  if (agentId !== ticket.assignedAgentId) {
    const agent = agentId ? await prisma.user.findFirst({ where: { id: agentId, ...assignableWhere(campusId) } }) : null;
    // The schema can't enforce this; it's the one place assignment is checked.
    if (agentId && !agent) throw new TicketError("Tickets can only be assigned to active agents who work at the ticket's campus.");
    data.assignedAgentId = agentId;
    events.push(agent ? `Assigned to ${agent.name}` : "Unassigned");
  }
  if (patch.departmentId && patch.departmentId !== ticket.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: patch.departmentId, isActive: true } });
    if (!dept) throw new TicketError("That department doesn't exist or is inactive.");
    data.departmentId = dept.id;
    events.push(`Transferred from ${ticket.department.name} to ${dept.name}`);
  }

  if (events.length === 0) return ticket;

  return prisma.$transaction(async (tx) => {
    for (const body of events) await systemEvent(tx, ticket.id, actor, body);
    await audit(tx, actor, "ticket.update", { type: "ticket", id: ticket.id }, { changes: events });
    const updated = await tx.ticket.update({ where: { id: ticket.id }, data });
    if (agentId && agentId !== ticket.assignedAgentId) await notifyAssigned(tx, ticket.id, actor);
    if (patch.status !== ticket.status) await notifyStatus(tx, ticket.id, actor, patch.status);
    return updated;
  });
}

export const BULK_LIMIT = 50;

export type BulkChange =
  | { status: TicketStatus }
  | { priority: TicketPriority }
  | { assignedAgentId: string | null }
  | { assignedTeamId: string | null };

// Applies one change to many tickets through `updateTicketFields`, so each ticket gets the same
// campus/assignment checks, system events, audit row and emails as a single edit.
export async function bulkUpdateTickets(actor: Actor, ticketNumbers: string[], change: BulkChange) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const numbers = [...new Set(ticketNumbers.map(normalizeNumber))];
  if (numbers.length === 0) throw new TicketError("Select at least one ticket.");
  if (numbers.length > BULK_LIMIT) throw new TicketError(`Select at most ${BULK_LIMIT} tickets at a time.`);

  let updated = 0;
  const skipped: { ticketNumber: string; reason: string }[] = [];
  for (const ticketNumber of numbers) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
    try {
      if (!ticket) throw new TicketError("Ticket not found.");
      await updateTicketFields(actor, ticketNumber, {
        status: ticket.status,
        priority: ticket.priority,
        assignedTeamId: ticket.assignedTeamId,
        assignedAgentId: ticket.assignedAgentId,
        ...change,
      });
      updated++;
    } catch (err) {
      if (!(err instanceof TicketError)) throw err;
      skipped.push({ ticketNumber, reason: err.message });
    }
  }
  return { updated, skipped };
}

// ─── Links & merges ─────────────────────────────────────────────────────────

// Both tickets must be at campuses the actor works at; others look like they don't exist.
async function findPair(actor: Actor, a: string, b: string) {
  const [from, to] = await Promise.all([
    prisma.ticket.findUnique({ where: { ticketNumber: normalizeNumber(a) } }),
    prisma.ticket.findUnique({ where: { ticketNumber: normalizeNumber(b) } }),
  ]);
  if (!from || !to || !canWorkTicket(actor, from) || !canWorkTicket(actor, to)) {
    throw new TicketError("Ticket not found. Check the ticket number.");
  }
  if (from.id === to.id) throw new TicketError("A ticket can't be linked to itself.");
  return { from, to };
}

export async function linkTickets(actor: Actor, ticketNumber: string, otherNumber: string) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const { from, to } = await findPair(actor, ticketNumber, otherNumber);
  const existing = await prisma.ticketLink.findFirst({
    where: { OR: [{ fromTicketId: from.id, toTicketId: to.id }, { fromTicketId: to.id, toTicketId: from.id }] },
  });
  if (existing) throw new TicketError(`${to.ticketNumber} is already linked.`);

  await prisma.$transaction(async (tx) => {
    await tx.ticketLink.create({ data: { fromTicketId: from.id, toTicketId: to.id, kind: "LINKED", createdById: actor.id } });
    await systemEvent(tx, from.id, actor, `Linked to ${to.ticketNumber}`);
    await systemEvent(tx, to.id, actor, `Linked to ${from.ticketNumber}`);
    await audit(tx, actor, "ticket.link", { type: "ticket", id: from.id }, { to: to.ticketNumber });
  });
}

export async function unlinkTickets(actor: Actor, ticketNumber: string, otherNumber: string) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const { from, to } = await findPair(actor, ticketNumber, otherNumber);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.ticketLink.deleteMany({
      where: {
        kind: "LINKED",
        OR: [{ fromTicketId: from.id, toTicketId: to.id }, { fromTicketId: to.id, toTicketId: from.id }],
      },
    });
    if (count === 0) return;
    await systemEvent(tx, from.id, actor, `Unlinked from ${to.ticketNumber}`);
    await systemEvent(tx, to.id, actor, `Unlinked from ${from.ticketNumber}`);
    await audit(tx, actor, "ticket.unlink", { type: "ticket", id: from.id }, { to: to.ticketNumber });
  });
}

// Moves the source ticket's conversation and tasks into the target, then closes the source.
// The source's requester and CCs become CCs on the target, so nobody loses sight of their messages.
export async function mergeTickets(actor: Actor, sourceNumber: string, targetNumber: string) {
  if (!isStaff(actor.role)) throw new TicketError("Not allowed.");
  const { from: source, to: target } = await findPair(actor, sourceNumber, targetNumber);
  const [sourceCcs, targetCcs] = await Promise.all([
    prisma.ticketCollaborator.findMany({ where: { ticketId: source.id }, select: { userId: true } }),
    prisma.ticketCollaborator.findMany({ where: { ticketId: target.id }, select: { userId: true } }),
  ]);
  const already = new Set([target.requesterId, ...targetCcs.map((c) => c.userId)]);
  const newCcs = [...new Set([source.requesterId, ...sourceCcs.map((c) => c.userId)])].filter((id) => !already.has(id));
  const alreadyMerged = await prisma.ticketLink.findFirst({ where: { fromTicketId: source.id, kind: "MERGED" } });
  if (alreadyMerged) throw new TicketError(`${source.ticketNumber} has already been merged.`);
  if (target.status === "CLOSED") throw new TicketError(`${target.ticketNumber} is closed. Reopen it first or merge the other way.`);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.ticketThread.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id } });
    await tx.task.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id } });
    if (newCcs.length > 0) {
      await tx.ticketCollaborator.createMany({ data: newCcs.map((userId) => ({ ticketId: target.id, userId, addedById: actor.id })) });
    }
    await tx.ticketLink.create({ data: { fromTicketId: source.id, toTicketId: target.id, kind: "MERGED", createdById: actor.id } });
    await systemEvent(tx, target.id, actor, `Merged ${source.ticketNumber} (“${source.subject}”) into this ticket`);
    await systemEvent(tx, source.id, actor, `Merged into ${target.ticketNumber}`);
    await tx.ticket.update({
      where: { id: source.id },
      data: { status: "CLOSED", closedByStaff: true, ...statusTimestamps("CLOSED", source, now) },
    });
    await tx.ticket.update({ where: { id: target.id }, data: { updatedAt: now } });
    await audit(tx, actor, "ticket.merge", { type: "ticket", id: source.id }, { into: target.ticketNumber });
  });
}

// ─── Attachments ────────────────────────────────────────────────────────────

// Returns the attachment only if the viewer may see the ticket *and* the entry it belongs to.
export async function getAttachmentForViewer(actor: Actor, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      threadEntry: {
        select: { type: true, ticket: { select: { requesterId: true, campusId: true, collaborators: { select: { userId: true } } } } },
      },
    },
  });
  if (!attachment) return null;
  const ticket = attachment.threadEntry.ticket;
  if (!canViewTicket(actor, ticket)) return null;
  if (attachment.threadEntry.type === "INTERNAL_NOTE" && !canWorkTicket(actor, ticket)) return null;
  return attachment;
}
