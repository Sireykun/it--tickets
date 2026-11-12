import { formatDateTime } from "@/lib/format";
import { audit } from "@/server/audit";
import { notifyOverdue } from "@/server/email/notify";
import { requeueStuck } from "@/server/email/smtp";
import { prisma } from "@/server/prisma";
import { slaState } from "@/server/sla";

// Housekeeping run by the worker every minute. Each step is safe to run on several workers at once.

const OVERDUE_BATCH = 50;
// Locks expire after 2 minutes; keeping them an hour longer costs nothing and helps debugging.
const LOCK_GRACE_MS = 60 * 60 * 1000;

export async function runMaintenance(now = new Date()): Promise<string | null> {
  const requeued = (await requeueStuck()).count;
  const alerted = await alertOverdueTickets(now);
  const locks = await purgeExpiredLocks(now);
  const parts = [requeued && `requeued ${requeued} stuck email`, alerted && `${alerted} overdue alert`, locks && `cleared ${locks} lock`];
  return parts.filter(Boolean).join(", ") || null;
}

// Alerts staff once per breach. Mirrors `slaState`: the response timer runs until the first agent
// reply, then the resolution timer.
export async function alertOverdueTickets(now = new Date()): Promise<number> {
  const candidates = await prisma.ticket.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      OR: [
        { firstRespondedAt: null, firstResponseDueAt: { lt: now }, responseOverdueAlertedAt: null },
        {
          resolutionDueAt: { lt: now },
          resolutionOverdueAlertedAt: null,
          OR: [{ firstRespondedAt: { not: null } }, { firstResponseDueAt: null }],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: OVERDUE_BATCH,
    select: { id: true, status: true, firstResponseDueAt: true, resolutionDueAt: true, firstRespondedAt: true },
  });

  let alerted = 0;
  for (const ticket of candidates) {
    const sla = slaState(ticket, now);
    if (sla.kind !== "response" && sla.kind !== "resolution") continue;
    const flag = sla.kind === "response" ? "responseOverdueAlertedAt" : "resolutionOverdueAlertedAt";
    const label = sla.kind === "response" ? "First response" : "Resolution";
    const isClaimed = await prisma.$transaction(async (tx) => {
      // The claim makes a second worker (or a retry) skip tickets that were already announced.
      const { count } = await tx.ticket.updateMany({ where: { id: ticket.id, [flag]: null }, data: { [flag]: now } });
      if (count === 0) return false;
      await audit(tx, null, "ticket.sla_overdue", { type: "ticket", id: ticket.id }, { timer: sla.kind, dueAt: sla.dueAt.toISOString() });
      await notifyOverdue(tx, ticket.id, `${label} was due ${formatDateTime(sla.dueAt)}.`);
      return true;
    });
    if (isClaimed) alerted++;
  }
  return alerted;
}

export async function purgeExpiredLocks(now = new Date()): Promise<number> {
  const { count } = await prisma.ticketLock.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - LOCK_GRACE_MS) } } });
  return count;
}
