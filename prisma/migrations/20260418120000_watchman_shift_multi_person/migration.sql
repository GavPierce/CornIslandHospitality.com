-- DropIndex (old unique on date + slot: only one watchman per slot per day)
DROP INDEX IF EXISTS "WatchmanShift_date_slot_key";

-- CreateIndex (new unique on watchmanId + date + slot: a person can't be assigned the same shift twice)
CREATE UNIQUE INDEX "WatchmanShift_watchmanId_date_slot_key" ON "WatchmanShift"("watchmanId", "date", "slot");
