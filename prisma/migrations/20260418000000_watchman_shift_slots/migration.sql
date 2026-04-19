-- CreateEnum
CREATE TYPE "ShiftSlot" AS ENUM ('EVENING', 'OVERNIGHT', 'MORNING', 'AFTERNOON');

-- DropIndex (old unique on watchmanId + date)
DROP INDEX IF EXISTS "WatchmanShift_watchmanId_date_key";

-- AlterTable: add slot column (defaults existing rows to EVENING)
ALTER TABLE "WatchmanShift" ADD COLUMN "slot" "ShiftSlot" NOT NULL DEFAULT 'EVENING';

-- CreateIndex (new unique on date + slot: only one watchman per slot per day)
CREATE UNIQUE INDEX "WatchmanShift_date_slot_key" ON "WatchmanShift"("date", "slot");

-- CreateIndex
CREATE INDEX "WatchmanShift_watchmanId_idx" ON "WatchmanShift"("watchmanId");
