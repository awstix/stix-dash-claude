-- Ergänzt Lagerbewegungswerte für Inventar-Historien.
ALTER TABLE "InventoryUsageHistory" ADD COLUMN "quantity" REAL;
ALTER TABLE "InventoryUsageHistory" ADD COLUMN "stockBefore" REAL;
ALTER TABLE "InventoryUsageHistory" ADD COLUMN "stockAfter" REAL;
