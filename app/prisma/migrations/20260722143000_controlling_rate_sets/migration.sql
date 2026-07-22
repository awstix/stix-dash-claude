CREATE TABLE "ControllingRateSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ControllingInventoryCategoryRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateSetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "billingRateCents" INTEGER,
    "idleBillingRateCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingInventoryCategoryRate_rateSetId_fkey" FOREIGN KEY ("rateSetId") REFERENCES "ControllingRateSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingInventoryCategoryRate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ControllingInventoryItemRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateSetId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "billingRateCents" INTEGER,
    "idleBillingRateCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingInventoryItemRate_rateSetId_fkey" FOREIGN KEY ("rateSetId") REFERENCES "ControllingRateSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingInventoryItemRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ControllingRateSet" ("id", "year", "name", "description", "isActive", "isDefault", "createdAt", "updatedAt")
VALUES ('rate-set-2026', 2026, 'Satzstand 2026', 'Automatisch aus bestehenden Verrechnungssätzen übernommen.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "ControllingInventoryCategoryRate" ("id", "rateSetId", "categoryId", "billingRateCents", "idleBillingRateCents", "createdAt", "updatedAt")
SELECT 'cat-rate-2026-' || "id", 'rate-set-2026', "id", "billingRateCents", "idleBillingRateCents", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "InventoryCategory"
WHERE "billingRateCents" IS NOT NULL OR "idleBillingRateCents" IS NOT NULL;

INSERT INTO "ControllingInventoryItemRate" ("id", "rateSetId", "itemId", "billingRateCents", "idleBillingRateCents", "createdAt", "updatedAt")
SELECT 'item-rate-2026-' || "id", 'rate-set-2026', "id", "billingRateCents", "idleBillingRateCents", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "InventoryItem"
WHERE "billingRateCents" IS NOT NULL OR "idleBillingRateCents" IS NOT NULL;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ControllingEmployeeGroupRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateSetId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "realRateCents" INTEGER NOT NULL DEFAULT 0,
    "internalRateCents" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "visibilityLevel" TEXT NOT NULL DEFAULT 'CONTROLLING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingEmployeeGroupRate_rateSetId_fkey" FOREIGN KEY ("rateSetId") REFERENCES "ControllingRateSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ControllingEmployeeGroupRate" ("id", "rateSetId", "name", "description", "realRateCents", "internalRateCents", "validFrom", "validTo", "visibilityLevel", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT "id", 'rate-set-2026', "name", "description", "realRateCents", "internalRateCents", "validFrom", "validTo", "visibilityLevel", "isActive", "sortOrder", "createdAt", "updatedAt"
FROM "ControllingEmployeeGroupRate";

DROP TABLE "ControllingEmployeeGroupRate";
ALTER TABLE "new_ControllingEmployeeGroupRate" RENAME TO "ControllingEmployeeGroupRate";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "ControllingRateSet_year_key" ON "ControllingRateSet"("year");
CREATE INDEX "ControllingRateSet_isActive_idx" ON "ControllingRateSet"("isActive");
CREATE INDEX "ControllingRateSet_isDefault_idx" ON "ControllingRateSet"("isDefault");

CREATE UNIQUE INDEX "ControllingInventoryCategoryRate_rateSetId_categoryId_key" ON "ControllingInventoryCategoryRate"("rateSetId", "categoryId");
CREATE INDEX "ControllingInventoryCategoryRate_categoryId_idx" ON "ControllingInventoryCategoryRate"("categoryId");

CREATE UNIQUE INDEX "ControllingInventoryItemRate_rateSetId_itemId_key" ON "ControllingInventoryItemRate"("rateSetId", "itemId");
CREATE INDEX "ControllingInventoryItemRate_itemId_idx" ON "ControllingInventoryItemRate"("itemId");

CREATE INDEX "ControllingEmployeeGroupRate_isActive_idx" ON "ControllingEmployeeGroupRate"("isActive");
CREATE INDEX "ControllingEmployeeGroupRate_rateSetId_idx" ON "ControllingEmployeeGroupRate"("rateSetId");
CREATE INDEX "ControllingEmployeeGroupRate_sortOrder_idx" ON "ControllingEmployeeGroupRate"("sortOrder");
CREATE INDEX "ControllingEmployeeGroupRate_visibilityLevel_idx" ON "ControllingEmployeeGroupRate"("visibilityLevel");
CREATE UNIQUE INDEX "ControllingEmployeeGroupRate_rateSetId_name_key" ON "ControllingEmployeeGroupRate"("rateSetId", "name");
