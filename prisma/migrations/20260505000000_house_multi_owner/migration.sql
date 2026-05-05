-- Migration: house_multi_owner
-- Replaces the single House.ownerId FK with a HouseOwner join table
-- so a house can have multiple volunteer owners.

-- 1. Create the new join table
CREATE TABLE "HouseOwner" (
    "houseId"     TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseOwner_pkey" PRIMARY KEY ("houseId", "volunteerId")
);

-- 2. Migrate any existing ownerId rows into the new table
INSERT INTO "HouseOwner" ("houseId", "volunteerId", "createdAt")
SELECT "id", "ownerId", NOW()
FROM   "House"
WHERE  "ownerId" IS NOT NULL;

-- 3. Add FK constraints on the new table
ALTER TABLE "HouseOwner"
    ADD CONSTRAINT "HouseOwner_houseId_fkey"
        FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HouseOwner"
    ADD CONSTRAINT "HouseOwner_volunteerId_fkey"
        FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Index on volunteerId for lookups by volunteer
CREATE INDEX "HouseOwner_volunteerId_idx" ON "HouseOwner"("volunteerId");

-- 5. Drop the old FK and column from House
ALTER TABLE "House" DROP CONSTRAINT IF EXISTS "House_ownerId_fkey";
ALTER TABLE "House" DROP COLUMN IF EXISTS "ownerId";
