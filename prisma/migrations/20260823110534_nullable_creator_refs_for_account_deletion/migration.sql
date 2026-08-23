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
    "uploadedById" TEXT,
    CONSTRAINT "BandFile_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BandFile" ("bandId", "category", "createdAt", "filename", "id", "mimeType", "shareToken", "size", "storageKey", "uploadedById", "visibility") SELECT "bandId", "category", "createdAt", "filename", "id", "mimeType", "shareToken", "size", "storageKey", "uploadedById", "visibility" FROM "BandFile";
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
    "createdById" TEXT,
    "locationId" TEXT,
    CONSTRAINT "Event_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("bandId", "createdAt", "createdById", "description", "endsAt", "id", "location", "locationId", "seriesId", "startsAt", "title", "type") SELECT "bandId", "createdAt", "createdById", "description", "endsAt", "id", "location", "locationId", "seriesId", "startsAt", "title", "type" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_FinanceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "eventId" TEXT,
    "createdById" TEXT,
    CONSTRAINT "FinanceEntry_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinanceEntry" ("amountCents", "bandId", "category", "createdAt", "createdById", "currency", "date", "description", "eventId", "id", "type") SELECT "amountCents", "bandId", "category", "createdAt", "createdById", "currency", "date", "description", "eventId", "id", "type" FROM "FinanceEntry";
DROP TABLE "FinanceEntry";
ALTER TABLE "new_FinanceEntry" RENAME TO "FinanceEntry";
CREATE TABLE "new_Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "guestUntil" DATETIME,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "invitedById" TEXT,
    CONSTRAINT "Invitation_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("acceptedAt", "bandId", "createdAt", "email", "expiresAt", "guestUntil", "id", "invitedById", "role", "token") SELECT "acceptedAt", "bandId", "createdAt", "email", "expiresAt", "guestUntil", "id", "invitedById", "role", "token" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE TABLE "new_SongFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'BAND',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" TEXT NOT NULL,
    "uploadedById" TEXT,
    CONSTRAINT "SongFile_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SongFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SongFile" ("createdAt", "filename", "id", "mimeType", "size", "songId", "storageKey", "uploadedById", "visibility") SELECT "createdAt", "filename", "id", "mimeType", "size", "songId", "storageKey", "uploadedById", "visibility" FROM "SongFile";
DROP TABLE "SongFile";
ALTER TABLE "new_SongFile" RENAME TO "SongFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
