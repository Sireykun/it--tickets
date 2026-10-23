import type { Prisma } from "@/generated/prisma/client";
import type { AuditCategory } from "@/lib/labels";
import { audit } from "@/server/audit";
import { prisma } from "@/server/prisma";
import { type AppUser, isSuperadmin } from "@/server/roles";
import { TicketError } from "@/server/tickets";

// The system log: sign-in/out records, and the superadmin-only view over every audit event.

export const AUDIT_PAGE_SIZE = 50;

type SignInVia = "password" | "google";

export function recordSignIn(userId: string, via: SignInVia) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await audit(tx, { id: userId }, "auth.login", { type: "user", id: userId }, { via });
  });
}

// Only for known accounts: attempts on unknown emails have nothing to link to and would log strangers' input.
export function recordFailedSignIn(userId: string, reason: "password" | "inactive", via: SignInVia) {
  return audit(prisma, null, "auth.login_failed", { type: "user", id: userId }, { reason, via });
}

export function recordSignOut(userId: string) {
  return audit(prisma, { id: userId }, "auth.logout", { type: "user", id: userId });
}

export type AuditLogFilters = {
  q?: string;
  category?: AuditCategory;
  from?: Date;
  to?: Date;
  page: number;
};

export async function listAuditEvents(actor: Pick<AppUser, "role" | "campusScope">, filters: AuditLogFilters) {
  if (!isSuperadmin(actor)) throw new TicketError("Not allowed.");

  // A person's events are the ones they did and the ones about them (failed sign-ins have no actor).
  let personWhere: Prisma.AuditEventWhereInput = {};
  if (filters.q) {
    const people = await prisma.user.findMany({
      where: { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }] },
      select: { id: true },
      take: 500,
    });
    const ids = people.map((p) => p.id);
    personWhere = { OR: [{ actorId: { in: ids } }, { entityType: "user", entityId: { in: ids } }] };
  }

  const where: Prisma.AuditEventWhereInput = {
    AND: [
      filters.category ? categoryWhere(filters.category) : {},
      filters.from || filters.to ? { createdAt: { gte: filters.from, lt: filters.to } } : {},
      personWhere,
    ],
  };
  const total = await prisma.auditEvent.count({ where });
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: filters.page * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      data: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  // Resolve targets in two batched lookups so the page can name them instead of showing ids.
  const idsOf = (type: string) => [...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId))];
  const tickets = await prisma.ticket.findMany({ where: { id: { in: idsOf("ticket") } }, select: { id: true, ticketNumber: true } });
  const users = await prisma.user.findMany({ where: { id: { in: idsOf("user") } }, select: { id: true, name: true } });
  const ticketNumbers = new Map(tickets.map((t) => [t.id, t.ticketNumber]));
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const events = rows.map((r) => ({
    ...r,
    ticketNumber: r.entityType === "ticket" ? (ticketNumbers.get(r.entityId) ?? null) : null,
    targetUserName: r.entityType === "user" ? (userNames.get(r.entityId) ?? null) : null,
  }));
  return { events, total, pageSize: AUDIT_PAGE_SIZE };
}

// "settings" is everything that isn't one of the other groups, so new settings actions land there automatically.
function categoryWhere(category: AuditCategory): Prisma.AuditEventWhereInput {
  const isExport: Prisma.AuditEventWhereInput = { action: { endsWith: ".export" } };
  switch (category) {
    case "auth":
      return { action: { startsWith: "auth." } };
    case "user":
      return { action: { startsWith: "user." } };
    case "export":
      return isExport;
    case "ticket":
      return { OR: [{ action: { startsWith: "ticket." } }, { action: { startsWith: "task." } }], NOT: isExport };
    case "settings":
      return {
        NOT: [
          { action: { startsWith: "auth." } },
          { action: { startsWith: "user." } },
          { action: { startsWith: "ticket." } },
          { action: { startsWith: "task." } },
          isExport,
        ],
      };
  }
}
