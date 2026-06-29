ALTER TABLE "InventoryItem" ADD COLUMN "lastTuvInspectionDate" DATETIME;
ALTER TABLE "InventoryItem" ADD COLUMN "nextTuvInspectionDate" DATETIME;

CREATE INDEX "InventoryItem_nextTuvInspectionDate_idx" ON "InventoryItem"("nextTuvInspectionDate");
