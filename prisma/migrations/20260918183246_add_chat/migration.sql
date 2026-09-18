-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "authorId" TEXT,
    CONSTRAINT "ChatMessage_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatReadMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastReadAt" DATETIME NOT NULL,
    "bandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChatReadMarker_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatReadMarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    "bandId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    CONSTRAINT "DirectMessage_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "rehearsalTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Band" ("bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "locationsEnabled", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "rehearsalTrackingEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "communicationEnabled", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "keyDetectionEnabled", "location", "locationsEnabled", "mediaPlayerEnabled", "name", "packlistsEnabled", "publicFileLinksEnabled", "rehearsalTrackingEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChatMessage_bandId_createdAt_idx" ON "ChatMessage"("bandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReadMarker_bandId_userId_key" ON "ChatReadMarker"("bandId", "userId");

-- CreateIndex
CREATE INDEX "DirectMessage_bandId_senderId_recipientId_createdAt_idx" ON "DirectMessage"("bandId", "senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_bandId_recipientId_readAt_idx" ON "DirectMessage"("bandId", "recipientId", "readAt");
