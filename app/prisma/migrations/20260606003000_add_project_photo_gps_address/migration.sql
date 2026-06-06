ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsAddressLabel" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsStreet" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsHouseNumber" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsPostcode" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsCity" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsCountry" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsReverseGeocodedAt" DATETIME;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsReverseGeocodeSource" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "gpsAddressJson" TEXT;

CREATE INDEX "ProjectPhoto_gpsCity_idx" ON "ProjectPhoto"("gpsCity");
