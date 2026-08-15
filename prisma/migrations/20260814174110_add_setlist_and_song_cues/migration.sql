/*
  Warnings:

  - You are about to drop the column `notes` on the `SetlistItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SongNote" ADD COLUMN "color" TEXT;
ALTER TABLE "SongNote" ADD COLUMN "cues" TEXT;
ALTER TABLE "SongNote" ADD COLUMN "shortNote" TEXT;

-- CreateTable
CREATE TABLE "SetlistNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "setlistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SetlistNote_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetlistItemAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT,
    "color" TEXT,
    "cues" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SetlistItemAnnotation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SetlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItemAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "customTitle" TEXT,
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

-- CreateIndex
CREATE UNIQUE INDEX "SetlistNote_setlistId_userId_key" ON "SetlistNote"("setlistId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItemAnnotation_itemId_userId_key" ON "SetlistItemAnnotation"("itemId", "userId");
