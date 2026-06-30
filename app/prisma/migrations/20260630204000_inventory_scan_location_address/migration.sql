-- Store reverse-geocoded scan locations for inventory QR/DataMatrix scans.
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationAddressLabel" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationStreet" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationHouseNumber" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationPostcode" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationCity" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationCountry" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationReverseGeocodedAt" DATETIME;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationReverseGeocodeSource" TEXT;
ALTER TABLE "InventoryScanLog" ADD COLUMN "locationAddressJson" TEXT;

CREATE INDEX "InventoryScanLog_locationCity_idx" ON "InventoryScanLog"("locationCity");
