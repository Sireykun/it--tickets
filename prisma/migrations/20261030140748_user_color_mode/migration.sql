-- AlterTable
ALTER TABLE "users" ADD COLUMN     "color_mode" TEXT;

-- Light/dark choice; NULL means not chosen yet (follow the device).
ALTER TABLE "users" ADD CONSTRAINT "users_color_mode_check" CHECK ("color_mode" IN ('light', 'dark', 'system'));
