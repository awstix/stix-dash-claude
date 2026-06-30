CREATE TABLE "InventoryScanLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'VIEW',
    "scannedByName" TEXT,
    "scannedByUserId" TEXT,
    "rawValue" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "accuracyMeters" REAL,
    "projectId" TEXT,
    "projectLabel" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryScanLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InventoryScanLog_itemId_idx" ON "InventoryScanLog"("itemId");
CREATE INDEX "InventoryScanLog_action_idx" ON "InventoryScanLog"("action");
CREATE INDEX "InventoryScanLog_createdAt_idx" ON "InventoryScanLog"("createdAt");
CREATE INDEX "InventoryScanLog_projectId_idx" ON "InventoryScanLog"("projectId");
