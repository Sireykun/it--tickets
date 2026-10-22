import type { Prisma } from "@/generated/prisma/client";

type Db = Pick<Prisma.TransactionClient, "auditEvent">;

// Append an audit record. Pass the transaction client so the record commits (or rolls back) with the change.
export function audit(
  db: Db,
  actor: { id: string } | null,
  action: string,
  entity: { type: string; id: string },
  data?: Prisma.InputJsonValue,
) {
  return db.auditEvent.create({
    data: { actorId: actor?.id ?? null, action, entityType: entity.type, entityId: entity.id, data },
  });
}
