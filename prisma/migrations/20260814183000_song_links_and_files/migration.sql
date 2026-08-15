-- CreateTable
CREATE TABLE "SongLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" TEXT NOT NULL,
    CONSTRAINT "SongLink_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing single streamingUrl values into SongLink rows
INSERT INTO "SongLink" ("id", "url", "createdAt", "songId")
SELECT lower(hex(randomblob(16))), "streamingUrl", CURRENT_TIMESTAMP, "id"
FROM "Song"
WHERE "streamingUrl" IS NOT NULL AND "streamingUrl" != '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "key" TEXT,
    "bpm" INTEGER,
    "timeSignature" TEXT,
    "durationSec" INTEGER,
    "genre" TEXT,
    "leadVocal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "lyrics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    CONSTRAINT "Song_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Song" ("id", "title", "key", "bpm", "timeSignature", "durationSec", "genre", "leadVocal", "status", "lyrics", "createdAt", "bandId")
SELECT "id", "title", "key", "bpm", "timeSignature", "durationSec", "genre", "leadVocal", "status", "lyrics", "createdAt", "bandId" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
