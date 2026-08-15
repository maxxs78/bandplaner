-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "customTitle" TEXT,
    "songDeleted" BOOLEAN NOT NULL DEFAULT false,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT,
    CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SetlistItem" ("customTitle", "id", "order", "setlistId", "songId") SELECT "customTitle", "id", "order", "setlistId", "songId" FROM "SetlistItem";
DROP TABLE "SetlistItem";
ALTER TABLE "new_SetlistItem" RENAME TO "SetlistItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
