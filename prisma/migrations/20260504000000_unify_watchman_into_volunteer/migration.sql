-- Unify Watchman into Volunteer.
--
-- Strategy:
--   1. Add `isWatchman` column to Volunteer.
--   2. For each Watchman row whose phone matches an existing Volunteer
--      by exact string equality: flag the Volunteer as a watchman and
--      backfill email/language if the Volunteer had them null.
--   3. For each remaining Watchman row (no Volunteer match): create a
--      new Volunteer row, defaulting `type` to SINGLE_BROTHER.
--   4. Remap WatchmanShift rows to point at Volunteer ids, rename the
--      column from `watchmanId` to `volunteerId`.
--   5. Remap AuthSession rows whose identityType = 'WATCHMAN' to point
--      at the merged Volunteer, and flip identityType to 'VOLUNTEER'.
--   6. Drop the Watchman table.

-- 1. Add the flag.
ALTER TABLE "Volunteer"
    ADD COLUMN "isWatchman" BOOLEAN NOT NULL DEFAULT false;

-- 2. Build a mapping from old Watchman.id -> target Volunteer.id.
--    This is a permanent table within the migration transaction; we drop
--    it at the end.
CREATE TEMP TABLE "_WatchmanMap" (
    "watchmanId"  TEXT PRIMARY KEY,
    "volunteerId" TEXT NOT NULL
);

-- 2a. Existing volunteers that share a phone with a watchman win the merge.
--     We pick the smallest volunteer id (stable) if somehow multiple
--     volunteers share a phone.
INSERT INTO "_WatchmanMap" ("watchmanId", "volunteerId")
SELECT w."id", (
    SELECT v."id"
    FROM "Volunteer" v
    WHERE v."phone" IS NOT NULL
      AND w."phone" IS NOT NULL
      AND v."phone" = w."phone"
    ORDER BY v."id" ASC
    LIMIT 1
)
FROM "Watchman" w
WHERE w."phone" IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM "Volunteer" v
      WHERE v."phone" = w."phone"
  );

-- 2b. Flip the flag + backfill nulls for those matched volunteers.
UPDATE "Volunteer" v
SET
    "isWatchman" = true,
    "email"      = COALESCE(v."email",    w."email"),
    "language"   = COALESCE(v."language", w."language")
FROM "Watchman" w
JOIN "_WatchmanMap" m ON m."watchmanId" = w."id"
WHERE v."id" = m."volunteerId";

-- 3. For watchmen with no volunteer match, create new Volunteer rows.
--    Reuse the watchman's id so we can remap shifts cheaply.
INSERT INTO "Volunteer" (
    "id", "name", "email", "phone", "type",
    "language", "isWatchman", "createdAt", "updatedAt"
)
SELECT
    w."id", w."name", w."email", w."phone", 'SINGLE_BROTHER'::"VolunteerType",
    w."language", true, w."createdAt", w."updatedAt"
FROM "Watchman" w
WHERE w."id" NOT IN (SELECT "watchmanId" FROM "_WatchmanMap");

INSERT INTO "_WatchmanMap" ("watchmanId", "volunteerId")
SELECT w."id", w."id"
FROM "Watchman" w
WHERE w."id" NOT IN (SELECT "watchmanId" FROM "_WatchmanMap");

-- 4. Rename WatchmanShift.watchmanId -> volunteerId and repoint the FK.
ALTER TABLE "WatchmanShift"
    DROP CONSTRAINT IF EXISTS "WatchmanShift_watchmanId_fkey";

ALTER TABLE "WatchmanShift"
    RENAME COLUMN "watchmanId" TO "volunteerId";

-- Remap any shifts whose owner was the "existing volunteer match" case
-- (where the watchman id differs from the target volunteer id).
UPDATE "WatchmanShift" s
SET "volunteerId" = m."volunteerId"
FROM "_WatchmanMap" m
WHERE s."volunteerId" = m."watchmanId"
  AND m."volunteerId" <> m."watchmanId";

-- Rename supporting indexes so they match the new column name.
ALTER INDEX IF EXISTS "WatchmanShift_watchmanId_date_slot_key"
    RENAME TO "WatchmanShift_volunteerId_date_slot_key";
ALTER INDEX IF EXISTS "WatchmanShift_watchmanId_idx"
    RENAME TO "WatchmanShift_volunteerId_idx";

-- Re-add the FK pointing at Volunteer.
ALTER TABLE "WatchmanShift"
    ADD CONSTRAINT "WatchmanShift_volunteerId_fkey"
    FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Remap AuthSession rows that were tied to the Watchman table.
UPDATE "AuthSession" s
SET
    "identityType" = 'VOLUNTEER'::"IdentityType",
    "identityId"   = m."volunteerId"
FROM "_WatchmanMap" m
WHERE s."identityType" = 'WATCHMAN'::"IdentityType"
  AND s."identityId"   = m."watchmanId";

-- 6. Drop the Watchman table and the temp map.
DROP TABLE "Watchman";
DROP TABLE "_WatchmanMap";
