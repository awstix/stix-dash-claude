ALTER TABLE "InventoryPhoto" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "InventoryPhoto_isPrimary_idx" ON "InventoryPhoto"("isPrimary");
