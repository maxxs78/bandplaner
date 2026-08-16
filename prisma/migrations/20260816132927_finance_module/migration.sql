-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "defaultPayoutAmountCents" INTEGER;

-- CreateTable
CREATE TABLE "BandFinanceAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "BandFinanceAdmin_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandFinanceAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
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
    "createdById" TEXT NOT NULL,
    CONSTRAINT "FinanceEntry_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financeEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Payout_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "FinanceEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "defaultGuestAccessDays" INTEGER,
    "publicFileLinksEnabled" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Band" ("bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BandFinanceAdmin_bandId_userId_key" ON "BandFinanceAdmin"("bandId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_financeEntryId_userId_key" ON "Payout"("financeEntryId", "userId");
