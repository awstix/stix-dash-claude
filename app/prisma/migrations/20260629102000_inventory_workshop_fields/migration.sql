ALTER TABLE "InventoryItem" ADD COLUMN "lastServiceAtDate" DATETIME;
ALTER TABLE "InventoryItem" ADD COLUMN "lastServiceOperatingHours" REAL;
ALTER TABLE "InventoryItem" ADD COLUMN "lastServiceMileageKm" INTEGER;
ALTER TABLE "InventoryItem" ADD COLUMN "nextServiceAtDate" DATETIME;
ALTER TABLE "InventoryItem" ADD COLUMN "nextServiceOperatingHours" REAL;
ALTER TABLE "InventoryItem" ADD COLUMN "nextServiceMileageKm" INTEGER;
ALTER TABLE "InventoryItem" ADD COLUMN "lastDguvInspectionDate" DATETIME;
ALTER TABLE "InventoryItem" ADD COLUMN "nextDguvInspectionDate" DATETIME;

CREATE INDEX "InventoryItem_nextServiceAtDate_idx" ON "InventoryItem"("nextServiceAtDate");
CREATE INDEX "InventoryItem_nextDguvInspectionDate_idx" ON "InventoryItem"("nextDguvInspectionDate");
