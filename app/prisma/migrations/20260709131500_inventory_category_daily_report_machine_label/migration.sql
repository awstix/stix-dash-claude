ALTER TABLE "InventoryCategory"
ADD COLUMN "dailyReportMachineLabel" TEXT;

UPDATE "InventoryCategory"
SET "dailyReportMachineLabel" = CASE
  WHEN "name" = 'Bagger-Mobil' THEN 'Mobilbagger'
  WHEN "name" = 'Bagger-Kette' THEN 'Kettenbagger'
  WHEN "name" = 'LKW 2-Achser' THEN 'LKW 2-Achser'
  WHEN "name" = 'LKW 3-Achser' THEN 'LKW 3-Achser'
  WHEN "name" = 'LKW 4-Achser' THEN 'LKW 4-Achser'
  WHEN "name" = 'LKW Sattel' THEN 'LKW Sattelzug'
  WHEN "name" = 'Radlader' THEN 'Radlader'
  WHEN "name" = 'Raupe' THEN 'Planierraupe'
  WHEN "name" = 'Grader' THEN 'Grader'
  WHEN "name" IN ('Walze-Asphalt', 'Walze-Erdbau') THEN 'Erdbauwalze / Walzenzug'
  WHEN "name" = 'Kompressoren' THEN 'Kompressor'
  ELSE "dailyReportMachineLabel"
END
WHERE "name" IN (
  'Bagger-Mobil',
  'Bagger-Kette',
  'LKW 2-Achser',
  'LKW 3-Achser',
  'LKW 4-Achser',
  'LKW Sattel',
  'Radlader',
  'Raupe',
  'Grader',
  'Walze-Asphalt',
  'Walze-Erdbau',
  'Kompressoren'
);

CREATE INDEX "InventoryCategory_dailyReportMachineLabel_idx"
ON "InventoryCategory"("dailyReportMachineLabel");
