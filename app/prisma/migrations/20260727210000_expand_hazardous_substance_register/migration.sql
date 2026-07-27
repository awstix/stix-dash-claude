ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "registerSection" TEXT NOT NULL DEFAULT 'HAZARDOUS';
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "sequentialNumber" TEXT;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "substanceType" TEXT;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "safetyDataSheetPresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "safetyDataSheetDate" DATETIME;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "operatingInstructionPresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "packageUnit" TEXT;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "quantity" REAL;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "repeatYears" INTEGER;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "repeatMonths" INTEGER;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "repeatDays" INTEGER;
ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "nextReviewDate" DATETIME;

CREATE INDEX "SafetyHazardousSubstance_registerSection_idx" ON "SafetyHazardousSubstance"("registerSection");
