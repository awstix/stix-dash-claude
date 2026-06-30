ALTER TABLE "InventoryItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");
