-- Verwendungsflags für Inventarkategorien.

ALTER TABLE "InventoryCategory" ADD COLUMN "useInTruckDisposition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryCategory" ADD COLUMN "useInDailyReports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryCategory" ADD COLUMN "useInInventory" BOOLEAN NOT NULL DEFAULT true;
