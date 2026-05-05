-- Migration: hospitality_team
-- Adds isHospitality flag to Volunteer, hospitalityMemberId FK to Assignment,
-- and three new ReminderKind enum values.

-- 1. Add isHospitality to Volunteer
ALTER TABLE "Volunteer" ADD COLUMN "isHospitality" BOOLEAN NOT NULL DEFAULT false;

-- 2. Add hospitalityMemberId FK to Assignment
ALTER TABLE "Assignment"
    ADD COLUMN "hospitalityMemberId" TEXT REFERENCES "Volunteer"("id") ON DELETE SET NULL;

CREATE INDEX "Assignment_hospitalityMemberId_idx" ON "Assignment"("hospitalityMemberId");

-- 3. Add new ReminderKind enum values
-- (PostgreSQL requires each ADD VALUE in a separate statement outside transactions
--  when targeting PG < 12; on PG 12+ these can all run in the same migration)
ALTER TYPE "ReminderKind" ADD VALUE IF NOT EXISTS 'HOSPITALITY_PAIRING';
ALTER TYPE "ReminderKind" ADD VALUE IF NOT EXISTS 'HOSPITALITY_CANCELLATION';
ALTER TYPE "ReminderKind" ADD VALUE IF NOT EXISTS 'HOSPITALITY_ARRIVAL';
