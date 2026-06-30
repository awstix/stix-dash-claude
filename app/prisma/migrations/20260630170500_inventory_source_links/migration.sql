-- Verknüpfung gespiegelter Stammdaten mit Inventarobjekten.

ALTER TABLE "InventoryItem" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "sourceId" TEXT;

CREATE INDEX "InventoryItem_sourceType_idx" ON "InventoryItem"("sourceType");
CREATE UNIQUE INDEX "InventoryItem_sourceType_sourceId_key" ON "InventoryItem"("sourceType", "sourceId");
