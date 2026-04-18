-- CreateTable
CREATE TABLE "Watchman" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchmanShift" (
    "id" TEXT NOT NULL,
    "watchmanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchmanShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchmanShift_date_idx" ON "WatchmanShift"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WatchmanShift_watchmanId_date_key" ON "WatchmanShift"("watchmanId", "date");

-- AddForeignKey
ALTER TABLE "WatchmanShift" ADD CONSTRAINT "WatchmanShift_watchmanId_fkey" FOREIGN KEY ("watchmanId") REFERENCES "Watchman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
