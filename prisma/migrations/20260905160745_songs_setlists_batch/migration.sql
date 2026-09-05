-- AlterTable
ALTER TABLE "Song" ADD COLUMN "cast" TEXT;

-- CreateTable
CREATE TABLE "RehearsalSong" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "addedById" TEXT,
    CONSTRAINT "RehearsalSong_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RehearsalSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RehearsalSong_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "locationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rehearsalTrackingEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Band" ("bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "locationsEnabled", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "locationsEnabled", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
CREATE TABLE "new_SetlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SONG',
    "customTitle" TEXT,
    "durationSec" INTEGER,
    "excludeFromNumbering" BOOLEAN NOT NULL DEFAULT false,
    "songDeleted" BOOLEAN NOT NULL DEFAULT false,
    "techNotes" TEXT,
    "segueToNext" BOOLEAN NOT NULL DEFAULT false,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT,
    CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SetlistItem" ("customTitle", "durationSec", "excludeFromNumbering", "id", "kind", "order", "setlistId", "songDeleted", "songId", "techNotes") SELECT "customTitle", "durationSec", "excludeFromNumbering", "id", "kind", "order", "setlistId", "songDeleted", "songId", "techNotes" FROM "SetlistItem";
DROP TABLE "SetlistItem";
ALTER TABLE "new_SetlistItem" RENAME TO "SetlistItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RehearsalSong_eventId_songId_key" ON "RehearsalSong"("eventId", "songId");
