ALTER TABLE "InventoryCategory"
ADD COLUMN "useInTeamManagement" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InventoryCategory"
SET "useInTeamManagement" = true
WHERE
  "name" IN (
    'LKW 2-Achser',
    'LKW 3-Achser',
    'LKW 4-Achser',
    'LKW Sattel',
    'PKW',
    'Sonderfahrzeuge',
    'Sonderfahrzeuge / Sondergeräte'
  )
  OR "parentCategoryId" IN (
    SELECT "id"
    FROM "InventoryCategory"
    WHERE "name" = 'Baumaschinen'
  );

CREATE INDEX "InventoryCategory_useInTeamManagement_idx"
ON "InventoryCategory"("useInTeamManagement");
