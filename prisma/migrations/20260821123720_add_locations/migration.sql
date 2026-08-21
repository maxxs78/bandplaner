-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "capacity" INTEGER,
    "stageAndTechNotes" TEXT,
    "loadingAndParkingNotes" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "Location_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Band" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "genre" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "contactEmail" TEXT,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "spotifyUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "packlistsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "financeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "communicationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mediaPlayerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "keyDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "financeSettlementMode" TEXT NOT NULL DEFAULT 'NO_BALANCE',
    "defaultGuestAccessDays" INTEGER,
    "publicFileLinksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "locationsEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Band" ("bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
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
    "locationId" TEXT,
    CONSTRAINT "BandFile_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandFile_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandFile_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BandFile_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BandFile" ("bandId", "category", "createdAt", "equipmentId", "eventId", "filename", "id", "mimeType", "shareToken", "size", "songId", "storageKey", "uploadedById", "visibility") SELECT "bandId", "category", "createdAt", "equipmentId", "eventId", "filename", "id", "mimeType", "shareToken", "size", "songId", "storageKey", "uploadedById", "visibility" FROM "BandFile";
DROP TABLE "BandFile";
ALTER TABLE "new_BandFile" RENAME TO "BandFile";
CREATE UNIQUE INDEX "BandFile_shareToken_key" ON "BandFile"("shareToken");
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REHEARSAL',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "seriesId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "locationId" TEXT,
    CONSTRAINT "Event_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("bandId", "createdAt", "createdById", "description", "endsAt", "id", "location", "seriesId", "startsAt", "title", "type") SELECT "bandId", "createdAt", "createdById", "description", "endsAt", "id", "location", "seriesId", "startsAt", "title", "type" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
