-- Fachliche BTB-Zuordnung für Inventarkategorien.

ALTER TABLE "InventoryCategory" ADD COLUMN "dailyReportSection" TEXT NOT NULL DEFAULT 'NONE';
