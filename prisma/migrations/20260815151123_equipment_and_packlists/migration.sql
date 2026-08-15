-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "ownerId" TEXT,
    CONSTRAINT "Equipment_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Packlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "eventId" TEXT,
    CONSTRAINT "Packlist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Packlist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PacklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "customName" TEXT,
    "packlistId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "assignedToId" TEXT,
    CONSTRAINT "PacklistItem_packlistId_fkey" FOREIGN KEY ("packlistId") REFERENCES "Packlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PacklistItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PacklistItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
