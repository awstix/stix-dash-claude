ALTER TABLE "InventoryItem" ADD COLUMN "currentLocationType" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "currentLocationLabel" TEXT;

CREATE INDEX "InventoryItem_currentLocationType_idx" ON "InventoryItem"("currentLocationType");
