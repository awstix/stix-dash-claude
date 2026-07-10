ALTER TABLE "InventoryCategory"
ADD COLUMN "asphaltDispositionUsage" TEXT NOT NULL DEFAULT 'NONE';

CREATE INDEX "InventoryCategory_asphaltDispositionUsage_idx"
ON "InventoryCategory"("asphaltDispositionUsage");
