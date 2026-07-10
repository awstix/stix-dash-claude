CREATE TABLE "InventoryItemEmployeeAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryItemEmployeeAssignment_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryItemEmployeeAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InventoryItemEmployeeAssignment_itemId_employeeId_key"
ON "InventoryItemEmployeeAssignment"("itemId", "employeeId");

CREATE INDEX "InventoryItemEmployeeAssignment_employeeId_idx"
ON "InventoryItemEmployeeAssignment"("employeeId");

CREATE INDEX "InventoryItemEmployeeAssignment_itemId_idx"
ON "InventoryItemEmployeeAssignment"("itemId");
