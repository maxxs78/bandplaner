-- AlterTable
ALTER TABLE "Event" ADD COLUMN "arrivalAt" DATETIME;
ALTER TABLE "Event" ADD COLUMN "gigStatus" TEXT;
ALTER TABLE "Event" ADD COLUMN "soundcheckAt" DATETIME;
ALTER TABLE "Event" ADD COLUMN "technicalRequirements" TEXT;

-- CreateTable
CREATE TABLE "BandLineupRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "BandLineupRole_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLineupEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventLineupEntry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLineupEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
