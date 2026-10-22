-- AlterEnum
ALTER TYPE "role" ADD VALUE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "campus_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "campus_id" UUID;

-- CreateTable
CREATE TABLE "campuses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_campuses" (
    "user_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_campuses_pkey" PRIMARY KEY ("user_id","campus_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campuses_name_key" ON "campuses"("name");

-- CreateIndex
CREATE INDEX "staff_campuses_campus_id_idx" ON "staff_campuses"("campus_id");

-- CreateIndex
CREATE INDEX "tickets_campus_id_status_idx" ON "tickets"("campus_id", "status");

-- CreateIndex
CREATE INDEX "users_campus_id_idx" ON "users"("campus_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_campuses" ADD CONSTRAINT "staff_campuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_campuses" ADD CONSTRAINT "staff_campuses_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
