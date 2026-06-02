-- Anspritzmittel / Haftkleber an Asphaltdisposition ergänzen
ALTER TABLE "AsphaltDispatchEntry" ADD COLUMN "tackCoatMaterialTypeId" TEXT REFERENCES "MaterialType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AsphaltDispatchEntry" ADD COLUMN "tackCoatMaterialName" TEXT;
ALTER TABLE "AsphaltDispatchEntry" ADD COLUMN "tackCoatQuantity" REAL NOT NULL DEFAULT 0;
ALTER TABLE "AsphaltDispatchEntry" ADD COLUMN "tackCoatUnit" TEXT;

CREATE INDEX "AsphaltDispatchEntry_tackCoatMaterialTypeId_idx" ON "AsphaltDispatchEntry"("tackCoatMaterialTypeId");
