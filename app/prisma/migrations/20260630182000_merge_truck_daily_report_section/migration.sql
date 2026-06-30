-- LKW gehört im BTB in die Tabelle Maschinen und Geräte.

UPDATE "InventoryCategory"
SET "dailyReportSection" = 'MACHINES'
WHERE "dailyReportSection" = 'TRUCKS';
