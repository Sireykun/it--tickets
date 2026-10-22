-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "closed_by_staff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ticket_kudos" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "recipient_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_kudos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_kudos_ticket_id_key" ON "ticket_kudos"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticket_kudos" ADD CONSTRAINT "ticket_kudos_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_kudos" ADD CONSTRAINT "ticket_kudos_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_kudos" ADD CONSTRAINT "ticket_kudos_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
