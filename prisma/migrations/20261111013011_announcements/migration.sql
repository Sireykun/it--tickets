-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "campus_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ends_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_is_active_ends_at_idx" ON "announcements"("is_active", "ends_at");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: keep in sync with ANNOUNCEMENT_LEVELS in src/lib/announcements.ts.
ALTER TABLE "announcements"
    ADD CONSTRAINT "announcements_level_check" CHECK ("level" IN ('info', 'warning', 'outage'));
