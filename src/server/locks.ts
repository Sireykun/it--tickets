import { prisma } from "@/server/prisma";
import { type AppUser, isStaff } from "@/server/roles";

// How long a lock survives without a heartbeat. The composer renews it every 60s while in use.
export const LOCK_TTL_MS = 2 * 60 * 1000;

export type LockHolder = { agentId: string; agentName: string; acquiredAt: Date };

// Takes or renews the reply lock for `actor`. If another agent holds an unexpired lock, nothing
// changes and their details are returned so the UI can warn. Atomic: a single upsert that only
// overwrites a lock that is expired or already ours.
export async function acquireLock(actor: Pick<AppUser, "id" | "role">, ticketId: string, now = new Date()): Promise<LockHolder | null> {
  if (!isStaff(actor.role)) return null;
  const expires = new Date(now.getTime() + LOCK_TTL_MS);
  await prisma.$executeRaw`
    INSERT INTO "ticket_locks" ("ticket_id", "agent_id", "acquired_at", "expires_at")
    VALUES (${ticketId}::uuid, ${actor.id}::uuid, ${now}, ${expires})
    ON CONFLICT ("ticket_id") DO UPDATE
      SET "agent_id" = EXCLUDED."agent_id",
          "acquired_at" = CASE WHEN "ticket_locks"."agent_id" = EXCLUDED."agent_id"
                               THEN "ticket_locks"."acquired_at" ELSE EXCLUDED."acquired_at" END,
          "expires_at" = EXCLUDED."expires_at"
      WHERE "ticket_locks"."agent_id" = EXCLUDED."agent_id" OR "ticket_locks"."expires_at" < ${now}`;
  return otherHolder(actor.id, ticketId, now);
}

export async function releaseLock(actor: Pick<AppUser, "id">, ticketId: string) {
  await prisma.ticketLock.deleteMany({ where: { ticketId, agentId: actor.id } });
}

// The agent (other than `viewerId`) currently replying, if any.
export async function otherHolder(viewerId: string, ticketId: string, now = new Date()): Promise<LockHolder | null> {
  const lock = await prisma.ticketLock.findUnique({ where: { ticketId }, include: { agent: { select: { name: true } } } });
  if (!lock || lock.agentId === viewerId || lock.expiresAt < now) return null;
  return { agentId: lock.agentId, agentName: lock.agent.name, acquiredAt: lock.acquiredAt };
}
