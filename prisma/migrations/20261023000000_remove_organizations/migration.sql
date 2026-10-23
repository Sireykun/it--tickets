-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_fkey";

-- DropIndex
DROP INDEX "users_organization_id_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "organization_id";

-- DropTable
DROP TABLE "organizations";
