ALTER TABLE "SafetyHazardousSubstance" ADD COLUMN "templateRowId" TEXT;

CREATE UNIQUE INDEX "SafetyHazardousSubstance_templateRowId_key"
ON "SafetyHazardousSubstance"("templateRowId");
