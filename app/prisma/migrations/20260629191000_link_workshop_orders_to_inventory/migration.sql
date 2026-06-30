ALTER TABLE "WorkshopRepairOrder" ADD COLUMN "inventoryItemId" TEXT;
CREATE INDEX "WorkshopRepairOrder_inventoryItemId_idx" ON "WorkshopRepairOrder"("inventoryItemId");
