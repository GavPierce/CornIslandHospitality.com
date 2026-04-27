-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM (
    'WATCHMAN_SHIFT',
    'VOLUNTEER_ARRIVAL',
    'VOLUNTEER_DEPARTURE',
    'ADMIN_DAILY_DIGEST'
);

-- AlterTable
ALTER TABLE "Watchman" ADD COLUMN "language" "Language";

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN "language" "Language";

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_kind_recipientPhone_referenceId_key"
    ON "ReminderLog"("kind", "recipientPhone", "referenceId");

-- CreateIndex
CREATE INDEX "ReminderLog_sentAt_idx" ON "ReminderLog"("sentAt");
