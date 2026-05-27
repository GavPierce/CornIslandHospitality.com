-- CreateTable
CREATE TABLE "HouseBlock" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseBlock_houseId_idx" ON "HouseBlock"("houseId");

-- CreateIndex
CREATE INDEX "HouseBlock_startDate_idx" ON "HouseBlock"("startDate");

-- AddForeignKey
ALTER TABLE "HouseBlock" ADD CONSTRAINT "HouseBlock_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
