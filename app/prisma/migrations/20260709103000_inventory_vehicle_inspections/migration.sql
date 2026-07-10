ALTER TABLE "InventoryItem"
ADD COLUMN "lastTachographInspectionDate" DATETIME;

ALTER TABLE "InventoryItem"
ADD COLUMN "nextTachographInspectionDate" DATETIME;

ALTER TABLE "InventoryItem"
ADD COLUMN "lastSafetyInspectionDate" DATETIME;

ALTER TABLE "InventoryItem"
ADD COLUMN "nextSafetyInspectionDate" DATETIME;

ALTER TABLE "InventoryItem"
ADD COLUMN "lastAdrInspectionDate" DATETIME;

ALTER TABLE "InventoryItem"
ADD COLUMN "nextAdrInspectionDate" DATETIME;

CREATE INDEX "InventoryItem_nextTachographInspectionDate_idx"
ON "InventoryItem"("nextTachographInspectionDate");

CREATE INDEX "InventoryItem_nextSafetyInspectionDate_idx"
ON "InventoryItem"("nextSafetyInspectionDate");

CREATE INDEX "InventoryItem_nextAdrInspectionDate_idx"
ON "InventoryItem"("nextAdrInspectionDate");
