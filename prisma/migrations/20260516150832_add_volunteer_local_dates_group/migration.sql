-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "arrivalDate" TIMESTAMP(3),
ADD COLUMN     "departureDate" TIMESTAMP(3),
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "isLocal" BOOLEAN NOT NULL DEFAULT false;
