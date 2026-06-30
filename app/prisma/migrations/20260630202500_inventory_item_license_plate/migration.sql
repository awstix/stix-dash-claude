-- Add vehicle license plate to inventory items so imported vehicles remain searchable without resolving the linked legacy vehicle.
ALTER TABLE "InventoryItem" ADD COLUMN "licensePlate" TEXT;

CREATE INDEX "InventoryItem_licensePlate_idx" ON "InventoryItem"("licensePlate");
