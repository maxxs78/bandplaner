-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "ownerId" TEXT,
    "responsibleId" TEXT,
    CONSTRAINT "Equipment_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Equipment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("bandId", "createdAt", "description", "id", "location", "name", "ownerId") SELECT "bandId", "createdAt", "description", "id", "location", "name", "ownerId" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
