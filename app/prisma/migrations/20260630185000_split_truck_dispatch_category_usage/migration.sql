-- LKW-Dispo-Verwendung sauber trennen:
-- 1) Material/Schüttgut
-- 2) Gerät/Objekt transportierbar

ALTER TABLE "InventoryCategory" ADD COLUMN "useInTruckDispatchMaterial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryCategory" ADD COLUMN "useInTruckDispatchObject" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InventoryCategory"
SET "useInTruckDispatchMaterial" = "useInTruckDisposition"
WHERE "useInTruckDisposition" = true;
