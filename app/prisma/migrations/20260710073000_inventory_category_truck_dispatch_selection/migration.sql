ALTER TABLE "InventoryCategory"
ADD COLUMN "useInTruckDispatchSelection" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InventoryCategory"
SET "useInTruckDispatchSelection" = true
WHERE
  "name" LIKE 'LKW%'
  OR "name" IN (
    'Sonderfahrzeuge',
    'Sonderfahrzeuge / Sondergeräte',
    'Sondergeräte'
  )
  OR "useInSpecialVehicleDisposition" = true
  OR "parentCategoryId" IN (
    SELECT "id"
    FROM "InventoryCategory"
    WHERE
      "name" LIKE 'LKW%'
      OR "name" IN (
        'Sonderfahrzeuge',
        'Sonderfahrzeuge / Sondergeräte',
        'Sondergeräte'
      )
      OR "useInSpecialVehicleDisposition" = true
  );

CREATE INDEX "InventoryCategory_useInTruckDispatchSelection_idx"
ON "InventoryCategory"("useInTruckDispatchSelection");
