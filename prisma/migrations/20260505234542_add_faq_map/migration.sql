-- AlterEnum
ALTER TYPE "ReminderKind" ADD VALUE 'ASSIGNMENT_FAQ_MAP';

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_hospitalityMemberId_fkey";

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_hospitalityMemberId_fkey" FOREIGN KEY ("hospitalityMemberId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
