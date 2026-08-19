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
    "financeSettlementMode" TEXT NOT NULL DEFAULT 'NO_BALANCE',
    "defaultGuestAccessDays" INTEGER,
    "publicFileLinksEnabled" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Band" ("bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl") SELECT "bio", "contactEmail", "createdAt", "defaultGuestAccessDays", "equipmentEnabled", "facebookUrl", "financeEnabled", "financeSettlementMode", "genre", "id", "imageUrl", "instagramUrl", "location", "name", "packlistsEnabled", "publicFileLinksEnabled", "spotifyUrl", "websiteUrl" FROM "Band";
DROP TABLE "Band";
ALTER TABLE "new_Band" RENAME TO "Band";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
