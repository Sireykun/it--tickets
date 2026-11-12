-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "resolution_overdue_alerted_at" TIMESTAMPTZ(3),
ADD COLUMN     "response_overdue_alerted_at" TIMESTAMPTZ(3);
