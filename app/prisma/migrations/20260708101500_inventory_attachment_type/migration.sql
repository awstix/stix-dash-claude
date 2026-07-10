ALTER TABLE "InventoryItem" ADD COLUMN "attachmentType" TEXT;

CREATE INDEX "InventoryItem_attachmentType_idx" ON "InventoryItem"("attachmentType");
