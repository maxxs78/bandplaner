-- CreateTable
CREATE TABLE "SongVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vote" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "songId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SongVote_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SongVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "lyrics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandId" TEXT NOT NULL,
    "proposedById" TEXT,
    CONSTRAINT "Song_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Song_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Song" ("bandId", "bpm", "createdAt", "durationSec", "genre", "id", "key", "leadVocal", "lyrics", "status", "timeSignature", "title") SELECT "bandId", "bpm", "createdAt", "durationSec", "genre", "id", "key", "leadVocal", "lyrics", "status", "timeSignature", "title" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SongVote_songId_userId_key" ON "SongVote"("songId", "userId");
