/*
  Warnings:

  - You are about to drop the `Payout` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Payout_financeEntryId_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Payout";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "FinanceAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "financeEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "FinanceAllocation_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "FinanceEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "financeSettlementMode" TEXT NOT NULL DEFAULT 'NO_BALANCE',
    "defaultGuestAccessDays" INTEGER,
    "publicFileLinksEnabled" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Band" ("bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAllocation_financeEntryId_userId_key" ON "FinanceAllocation"("financeEntryId", "userId");
