-- Create inventory location alerts for QR/DataMatrix scans whose GPS location differs from the assigned project.
CREATE TABLE "InventoryLocationAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "scanLogId" TEXT NOT NULL,
  "currentProjectId" TEXT,
  "suggestedProjectId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "distanceToCurrentMeters" REAL,
  "distanceToSuggestedMeters" REAL,
  "scanAddressLabel" TEXT,
  "scannedByName" TEXT,
  "assignedByName" TEXT,
  "resolvedAt" DATETIME,
  "resolvedByName" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "InventoryLocationAlert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryLocationAlert_scanLogId_fkey" FOREIGN KEY ("scanLogId") REFERENCES "InventoryScanLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryLocationAlert_currentProjectId_fkey" FOREIGN KEY ("currentProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InventoryLocationAlert_suggestedProjectId_fkey" FOREIGN KEY ("suggestedProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InventoryLocationAlert_scanLogId_key" ON "InventoryLocationAlert"("scanLogId");
CREATE INDEX "InventoryLocationAlert_itemId_idx" ON "InventoryLocationAlert"("itemId");
CREATE INDEX "InventoryLocationAlert_status_idx" ON "InventoryLocationAlert"("status");
CREATE INDEX "InventoryLocationAlert_createdAt_idx" ON "InventoryLocationAlert"("createdAt");
CREATE INDEX "InventoryLocationAlert_currentProjectId_idx" ON "InventoryLocationAlert"("currentProjectId");
CREATE INDEX "InventoryLocationAlert_suggestedProjectId_idx" ON "InventoryLocationAlert"("suggestedProjectId");
