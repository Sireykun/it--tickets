-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_mime_type" TEXT,
ADD COLUMN     "avatar_storage_key" TEXT,
ADD COLUMN     "theme_preference" TEXT NOT NULL DEFAULT 'ocean';
