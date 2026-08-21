-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SONG',
    "customTitle" TEXT,
    "durationSec" INTEGER,
    "excludeFromNumbering" BOOLEAN NOT NULL DEFAULT false,
    "songDeleted" BOOLEAN NOT NULL DEFAULT false,
    "setlistId" TEXT NOT NULL,
    "songId" TEXT,
    CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SetlistItem" ("customTitle", "id", "order", "setlistId", "songDeleted", "songId") SELECT "customTitle", "id", "order", "setlistId", "songDeleted", "songId" FROM "SetlistItem";
DROP TABLE "SetlistItem";
ALTER TABLE "new_SetlistItem" RENAME TO "SetlistItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Manuell ergaenzt (nicht von `prisma migrate diff` generiert): bestehende
-- manuelle Eintraege (kein verknuepfter Song) trugen bislang kein "kind" und
-- wurden oben per Spalten-Default faelschlich auf SONG gesetzt - hier auf den
-- tatsaechlichen Typ zurueckkorrigieren.
UPDATE "SetlistItem" SET "kind" = 'CUSTOM' WHERE "songId" IS NULL;
