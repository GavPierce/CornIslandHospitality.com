-- AlterEnum
ALTER TYPE "ReminderKind" ADD VALUE 'ASSIGNMENT_CONFIRMATION';

-- AlterTable
ALTER TABLE "House" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
