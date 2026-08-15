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
    "eventId" TEXT,
    "songId" TEXT,
    "equipmentId" TEXT,
    CONSTRAINT "BandFile_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandFile_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandFile_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BandFile" ("bandId", "category", "createdAt", "eventId", "filename", "id", "mimeType", "shareToken", "size", "songId", "storageKey", "uploadedById", "visibility") SELECT "bandId", "category", "createdAt", "eventId", "filename", "id", "mimeType", "shareToken", "size", "songId", "storageKey", "uploadedById", "visibility" FROM "BandFile";
DROP TABLE "BandFile";
ALTER TABLE "new_BandFile" RENAME TO "BandFile";
CREATE UNIQUE INDEX "BandFile_shareToken_key" ON "BandFile"("shareToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
