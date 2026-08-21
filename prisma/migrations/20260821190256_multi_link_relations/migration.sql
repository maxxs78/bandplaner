-- CreateTable
CREATE TABLE "SetlistItemEventAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT,
    "color" TEXT,
    "cues" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "itemId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SetlistItemEventAnnotation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SetlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItemEventAnnotation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItemEventAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetlistEventNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "setlistId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SetlistEventNote_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistEventNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistEventNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PacklistItemEventStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "assignedToId" TEXT,
    CONSTRAINT "PacklistItemEventStatus_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PacklistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PacklistItemEventStatus_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PacklistItemEventStatus_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EventToSetlist" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EventToSetlist_A_fkey" FOREIGN KEY ("A") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventToSetlist_B_fkey" FOREIGN KEY ("B") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EventToPacklist" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EventToPacklist_A_fkey" FOREIGN KEY ("A") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventToPacklist_B_fkey" FOREIGN KEY ("B") REFERENCES "Packlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BandFileToEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BandFileToEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "BandFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BandFileToEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BandFileToSong" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BandFileToSong_A_fkey" FOREIGN KEY ("A") REFERENCES "BandFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BandFileToSong_B_fkey" FOREIGN KEY ("B") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BandFileToEquipment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BandFileToEquipment_A_fkey" FOREIGN KEY ("A") REFERENCES "BandFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BandFileToEquipment_B_fkey" FOREIGN KEY ("B") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BandFileToLocation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BandFileToLocation_A_fkey" FOREIGN KEY ("A") REFERENCES "BandFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BandFileToLocation_B_fkey" FOREIGN KEY ("B") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Manuell ergaenzt (nicht von `prisma migrate diff` generiert): bestehende
-- Einfach-Verknuepfungen in die neuen m:n-Tabellen uebernehmen, BEVOR die
-- alten Spalten weiter unten beim Tabellen-Rebuild entfernt werden.
INSERT INTO "_BandFileToEvent" ("A", "B") SELECT "id", "eventId" FROM "BandFile" WHERE "eventId" IS NOT NULL;
INSERT INTO "_BandFileToSong" ("A", "B") SELECT "id", "songId" FROM "BandFile" WHERE "songId" IS NOT NULL;
INSERT INTO "_BandFileToEquipment" ("A", "B") SELECT "id", "equipmentId" FROM "BandFile" WHERE "equipmentId" IS NOT NULL;
INSERT INTO "_BandFileToLocation" ("A", "B") SELECT "id", "locationId" FROM "BandFile" WHERE "locationId" IS NOT NULL;
INSERT INTO "_EventToSetlist" ("A", "B") SELECT "eventId", "id" FROM "Setlist" WHERE "eventId" IS NOT NULL;
INSERT INTO "_EventToPacklist" ("A", "B") SELECT "eventId", "id" FROM "Packlist" WHERE "eventId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BandFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "shareToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    CONSTRAINT "BandFile_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BandFile" ("bandId", "category", "createdAt", "filename", "id", "mimeType", "shareToken", "size", "storageKey", "uploadedById", "visibility") SELECT "bandId", "category", "createdAt", "filename", "id", "mimeType", "shareToken", "size", "storageKey", "uploadedById", "visibility" FROM "BandFile";
DROP TABLE "BandFile";
ALTER TABLE "new_BandFile" RENAME TO "BandFile";
CREATE UNIQUE INDEX "BandFile_shareToken_key" ON "BandFile"("shareToken");
CREATE TABLE "new_Packlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "Packlist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Packlist" ("bandId", "createdAt", "id", "name") SELECT "bandId", "createdAt", "id", "name" FROM "Packlist";
DROP TABLE "Packlist";
ALTER TABLE "new_Packlist" RENAME TO "Packlist";
CREATE TABLE "new_Setlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "Setlist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setlist" ("bandId", "createdAt", "id", "name") SELECT "bandId", "createdAt", "id", "name" FROM "Setlist";
DROP TABLE "Setlist";
ALTER TABLE "new_Setlist" RENAME TO "Setlist";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItemEventAnnotation_itemId_eventId_userId_key" ON "SetlistItemEventAnnotation"("itemId", "eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistEventNote_setlistId_eventId_userId_key" ON "SetlistEventNote"("setlistId", "eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PacklistItemEventStatus_itemId_eventId_key" ON "PacklistItemEventStatus"("itemId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "_EventToSetlist_AB_unique" ON "_EventToSetlist"("A", "B");

-- CreateIndex
CREATE INDEX "_EventToSetlist_B_index" ON "_EventToSetlist"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_EventToPacklist_AB_unique" ON "_EventToPacklist"("A", "B");

-- CreateIndex
CREATE INDEX "_EventToPacklist_B_index" ON "_EventToPacklist"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BandFileToEvent_AB_unique" ON "_BandFileToEvent"("A", "B");

-- CreateIndex
CREATE INDEX "_BandFileToEvent_B_index" ON "_BandFileToEvent"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BandFileToSong_AB_unique" ON "_BandFileToSong"("A", "B");

-- CreateIndex
CREATE INDEX "_BandFileToSong_B_index" ON "_BandFileToSong"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BandFileToEquipment_AB_unique" ON "_BandFileToEquipment"("A", "B");

-- CreateIndex
CREATE INDEX "_BandFileToEquipment_B_index" ON "_BandFileToEquipment"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BandFileToLocation_AB_unique" ON "_BandFileToLocation"("A", "B");

-- CreateIndex
CREATE INDEX "_BandFileToLocation_B_index" ON "_BandFileToLocation"("B");
