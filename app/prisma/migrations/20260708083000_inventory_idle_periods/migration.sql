ALTER TABLE "InventoryItem" ADD COLUMN "idleBillingRateCents" INTEGER;

CREATE TABLE "InventoryIdlePeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryIdlePeriod_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InventoryIdlePeriod_itemId_idx" ON "InventoryIdlePeriod"("itemId");
CREATE INDEX "InventoryIdlePeriod_startsAt_idx" ON "InventoryIdlePeriod"("startsAt");
CREATE INDEX "InventoryIdlePeriod_endsAt_idx" ON "InventoryIdlePeriod"("endsAt");
