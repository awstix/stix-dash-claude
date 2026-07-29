CREATE TABLE "InventoryPersonalAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "returnedQuantity" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedCondition" TEXT,
    "issueNotes" TEXT,
    "issueSignatureDataUrl" TEXT NOT NULL,
    "issuedByName" TEXT,
    "returnedAt" DATETIME,
    "returnedCondition" TEXT,
    "returnNotes" TEXT,
    "returnSignatureDataUrl" TEXT,
    "returnedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryPersonalAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryPersonalAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "InventoryCategory" ADD COLUMN "isPersonalInventory" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "InventoryPersonalAssignment_itemId_idx" ON "InventoryPersonalAssignment"("itemId");
CREATE INDEX "InventoryPersonalAssignment_employeeId_idx" ON "InventoryPersonalAssignment"("employeeId");
CREATE INDEX "InventoryPersonalAssignment_status_idx" ON "InventoryPersonalAssignment"("status");
CREATE INDEX "InventoryPersonalAssignment_issuedAt_idx" ON "InventoryPersonalAssignment"("issuedAt");
CREATE INDEX "InventoryPersonalAssignment_returnedAt_idx" ON "InventoryPersonalAssignment"("returnedAt");
CREATE INDEX "InventoryCategory_isPersonalInventory_idx" ON "InventoryCategory"("isPersonalInventory");
