-- Nummernkreise pro Inventarkategorie und sichtbare 8-stellige Objekt-ID pro Inventarobjekt.

ALTER TABLE "InventoryCategory" ADD COLUMN "objectNumberStart" INTEGER;
ALTER TABLE "InventoryCategory" ADD COLUMN "objectNumberEnd" INTEGER;
ALTER TABLE "InventoryCategory" ADD COLUMN "nextObjectNumber" INTEGER;

ALTER TABLE "InventoryItem" ADD COLUMN "objectNumber" TEXT;

CREATE UNIQUE INDEX "InventoryItem_objectNumber_key" ON "InventoryItem"("objectNumber");
CREATE INDEX "InventoryItem_objectNumber_idx" ON "InventoryItem"("objectNumber");
