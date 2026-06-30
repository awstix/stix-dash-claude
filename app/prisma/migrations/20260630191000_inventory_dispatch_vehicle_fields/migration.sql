-- Optionale Dispo-/Fahrzeugdaten für Inventarobjekte.

ALTER TABLE "InventoryItem" ADD COLUMN "axleCount" INTEGER;
ALTER TABLE "InventoryItem" ADD COLUMN "grossWeightKg" INTEGER;
ALTER TABLE "InventoryItem" ADD COLUMN "payloadKg" INTEGER;
ALTER TABLE "InventoryItem" ADD COLUMN "driveType" TEXT;

CREATE INDEX "InventoryItem_driveType_idx" ON "InventoryItem"("driveType");
