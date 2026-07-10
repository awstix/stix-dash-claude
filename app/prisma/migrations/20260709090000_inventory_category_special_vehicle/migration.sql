ALTER TABLE "InventoryCategory"
ADD COLUMN "useInSpecialVehicleDisposition" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "InventoryCategory_useInSpecialVehicleDisposition_idx"
ON "InventoryCategory"("useInSpecialVehicleDisposition");
