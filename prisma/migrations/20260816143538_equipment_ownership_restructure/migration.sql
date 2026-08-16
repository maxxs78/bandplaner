-- RedefineTables
-- Equipment gehoert nicht mehr zwingend einer Band (bandId), sondern hat einen
-- Owner: entweder eine Band (ownerBandId, weiterhin nur innerhalb dieser Band
-- nutzbar) oder eine Person (ownerUserId, nutzbar in jeder Band, in der die
-- Person Mitglied ist). Datenmigration: bisheriges Band-Equipment (ownerId
-- NULL) -> ownerBandId = alte bandId; bisheriges persoenliches Equipment
-- (ownerId gesetzt) -> ownerUserId = altes ownerId.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerUserId" TEXT,
    "ownerBandId" TEXT,
    "responsibleId" TEXT,
    CONSTRAINT "Equipment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_ownerBandId_fkey" FOREIGN KEY ("ownerBandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("id", "name", "description", "category", "location", "createdAt", "ownerUserId", "ownerBandId", "responsibleId")
SELECT
  "id", "name", "description", "category", "location", "createdAt",
  "ownerId" AS "ownerUserId",
  CASE WHEN "ownerId" IS NULL THEN "bandId" ELSE NULL END AS "ownerBandId",
  "responsibleId"
FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
