/*
  Warnings:

  - You are about to drop the column `url` on the `SongFile` table. All the data in the column will be lost.
  - Added the required column `storageKey` to the `SongFile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SongFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'BAND',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "songId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    CONSTRAINT "SongFile_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SongFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SongFile" ("createdAt", "filename", "id", "mimeType", "size", "songId", "uploadedById", "visibility") SELECT "createdAt", "filename", "id", "mimeType", "size", "songId", "uploadedById", "visibility" FROM "SongFile";
DROP TABLE "SongFile";
ALTER TABLE "new_SongFile" RENAME TO "SongFile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
