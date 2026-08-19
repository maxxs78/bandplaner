-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "guestUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "defaultPayoutAmountCents" INTEGER,
    "notifyOnNewEvent" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnEventChange" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSongProposal" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNewFile" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFinanceAllocation" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("bandId", "createdAt", "defaultPayoutAmountCents", "guestUntil", "id", "role", "userId") SELECT "bandId", "createdAt", "defaultPayoutAmountCents", "guestUntil", "id", "role", "userId" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_userId_bandId_key" ON "Membership"("userId", "bandId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
