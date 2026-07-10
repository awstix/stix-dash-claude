ALTER TABLE "InventoryItem" ADD COLUMN "stixId" TEXT;

CREATE UNIQUE INDEX "InventoryItem_stixId_key" ON "InventoryItem"("stixId");
CREATE INDEX "InventoryItem_stixId_idx" ON "InventoryItem"("stixId");
