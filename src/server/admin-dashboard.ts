import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/server/prisma";
import { type AppUser, isSuperadmin } from "@/server/roles";
import { TicketError } from "@/server/tickets";

// Read-only overview for the admin dashboard (superadmin-only, so no audit row).

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

const OPEN: Prisma.TicketWhereInput = { status: { in: ["OPEN", "IN_PROGRESS"] } };
const OVERDUE = (now: Date): Prisma.TicketWhereInput => ({
  OR: [{ firstRespondedAt: null, firstResponseDueAt: { lt: now } }, { resolutionDueAt: { lt: now } }],
});

export async function getAdminDashboard(actor: Pick<AppUser, "role" | "campusScope">, now: Date = new Date()) {
  if (!isSuperadmin(actor)) throw new TicketError("Not allowed.");
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  // Sequential on purpose: many cheap queries, and it keeps the pool free for page requests.
  const open = await prisma.ticket.count({ where: OPEN });
  const unassigned = await prisma.ticket.count({ where: { ...OPEN, assignedAgentId: null } });
  const overdue = await prisma.ticket.count({ where: { AND: [OPEN, OVERDUE(now)] } });
  const urgent = await prisma.ticket.count({ where: { ...OPEN, priority: { in: ["HIGH", "EMERGENCY"] } } });
  const createdDay = await prisma.ticket.count({ where: { createdAt: { gte: dayAgo } } });
  const resolvedDay = await prisma.ticket.count({ where: { resolvedAt: { gte: dayAgo } } });
  const openTasks = await prisma.task.count({ where: { status: "OPEN" } });
  const openByCampus = await countByCampus(OPEN);
  const unassignedByCampus = await countByCampus({ ...OPEN, assignedAgentId: null });
  const overdueByCampus = await countByCampus({ AND: [OPEN, OVERDUE(now)] });
  const urgentByCampus = await countByCampus({ ...OPEN, priority: { in: ["HIGH", "EMERGENCY"] } });
  const createdDayByCampus = await countByCampus({ createdAt: { gte: dayAgo } });
  const openByAgent = await prisma.ticket.groupBy({
    by: ["assignedAgentId"],
    where: { ...OPEN, assignedAgentId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { assignedAgentId: "desc" } },
    take: 5,
  });
  const agentNames = await prisma.user.findMany({
    where: { id: { in: openByAgent.map((r) => r.assignedAgentId!) } },
    select: { id: true, name: true },
  });

  const activeByRole = await prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
  const inactiveUsers = await prisma.user.count({ where: { isActive: false } });
  const recentLogins = await prisma.user.count({ where: { lastLoginAt: { gte: weekAgo } } });

  // Creation order gives each campus a stable colour slot that survives renames and count changes.
  const campuses = await prisma.campus.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, isActive: true } });
  const config = {
    campuses: { active: campuses.filter((c) => c.isActive).length, total: campuses.length },
    departments: { active: await prisma.department.count({ where: { isActive: true } }), total: await prisma.department.count() },
    teams: { active: await prisma.team.count({ where: { isActive: true } }), total: await prisma.team.count() },
    helpTopics: { active: await prisma.helpTopic.count({ where: { isActive: true } }), total: await prisma.helpTopic.count() },
    slaPolicies: { active: await prisma.slaPolicy.count({ where: { isActive: true } }), total: await prisma.slaPolicy.count() },
    cannedResponses: { active: await prisma.cannedResponse.count({ where: { isActive: true } }), total: await prisma.cannedResponse.count() },
    kbArticles: {
      active: await prisma.kbArticle.count({ where: { isPublished: true } }),
      total: await prisma.kbArticle.count(),
    },
  };

  const outbox = await prisma.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } });
  const inbound = await prisma.inboundEmail.groupBy({ by: ["status"], where: { receivedAt: { gte: weekAgo } }, _count: { _all: true } });

  const activity = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { name: true } } },
  });

  const toCounts = <K extends string>(rows: { status: K; _count: { _all: number } }[]) =>
    Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<K, number>>;

  return {
    tickets: { open, unassigned, overdue, urgent, createdDay, resolvedDay, openTasks },
    // Tickets from before campuses existed have no campus; they get a row only while some are open.
    campuses: [...campuses, ...(openByCampus.has(null) ? [{ id: null, name: "No campus", isActive: true }] : [])].map((c, slot) => ({
      ...c,
      slot: c.id === null ? null : slot,
      open: openByCampus.get(c.id) ?? 0,
      unassigned: unassignedByCampus.get(c.id) ?? 0,
      overdue: overdueByCampus.get(c.id) ?? 0,
      urgent: urgentByCampus.get(c.id) ?? 0,
      createdDay: createdDayByCampus.get(c.id) ?? 0,
    })),
    topAgents: openByAgent.map((r) => ({
      id: r.assignedAgentId!,
      name: agentNames.find((u) => u.id === r.assignedAgentId)?.name ?? "Unknown",
      open: r._count._all,
    })),
    people: {
      activeByRole: Object.fromEntries(activeByRole.map((r) => [r.role, r._count._all])) as Partial<Record<Role, number>>,
      inactive: inactiveUsers,
      recentLogins,
    },
    config,
    email: { outbox: toCounts(outbox), inbound: toCounts(inbound) },
    activity,
  };
}

async function countByCampus(where: Prisma.TicketWhereInput) {
  const rows = await prisma.ticket.groupBy({ by: ["campusId"], where, _count: { _all: true } });
  return new Map(rows.map((r) => [r.campusId, r._count._all]));
}
