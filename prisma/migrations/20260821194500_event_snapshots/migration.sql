-- CreateTable
CREATE TABLE "SetlistEventSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setlistId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "SetlistEventSnapshot_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistEventSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PacklistEventSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packlistId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "PacklistEventSnapshot_packlistId_fkey" FOREIGN KEY ("packlistId") REFERENCES "Packlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PacklistEventSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SetlistEventSnapshot_setlistId_eventId_key" ON "SetlistEventSnapshot"("setlistId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PacklistEventSnapshot_packlistId_eventId_key" ON "PacklistEventSnapshot"("packlistId", "eventId");
