-- AlterTable
ALTER TABLE "SetlistItem" ADD COLUMN "techNotes" TEXT;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN "techNotes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentIconDisplay" TEXT NOT NULL DEFAULT 'IN_TAG',
    "techNotes" TEXT,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "Setlist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setlist" ("bandId", "createdAt", "id", "name") SELECT "bandId", "createdAt", "id", "name" FROM "Setlist";
DROP TABLE "Setlist";
ALTER TABLE "new_Setlist" RENAME TO "Setlist";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
