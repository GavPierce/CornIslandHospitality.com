-- CreateEnum
CREATE TYPE "ArrivalTransport" AS ENUM ('BOAT', 'PLANE');

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "arrivalTransport" "ArrivalTransport";
