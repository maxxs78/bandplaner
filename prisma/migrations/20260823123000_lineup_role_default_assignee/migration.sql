-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BandLineupRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bandId" TEXT NOT NULL,
    "defaultAssigneeId" TEXT,
    CONSTRAINT "BandLineupRole_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BandLineupRole_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BandLineupRole" ("bandId", "id", "name", "order") SELECT "bandId", "id", "name", "order" FROM "BandLineupRole";
DROP TABLE "BandLineupRole";
ALTER TABLE "new_BandLineupRole" RENAME TO "BandLineupRole";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
