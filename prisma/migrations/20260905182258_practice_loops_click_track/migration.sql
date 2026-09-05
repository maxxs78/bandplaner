-- AlterTable
ALTER TABLE "Song" ADD COLUMN "clickOffsetMs" INTEGER;
ALTER TABLE "Song" ADD COLUMN "countInBeats" INTEGER;

-- CreateTable
CREATE TABLE "PracticeLoop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startSec" REAL NOT NULL,
    "endSec" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" TEXT NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "PracticeLoop_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeLoop_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PracticeLoop_songId_idx" ON "PracticeLoop"("songId");
