-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "created_by_id" UUID;

-- CreateIndex
CREATE INDEX "tickets_created_by_id_idx" ON "tickets"("created_by_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: the creator of existing tickets is the actor of their "ticket.create" audit event.
UPDATE "tickets" t
SET "created_by_id" = a."actor_id"
FROM "audit_events" a
WHERE a."action" = 'ticket.create'
  AND a."entity_type" = 'ticket'
  AND a."entity_id" = t."id"::text
  AND a."actor_id" IS NOT NULL;
