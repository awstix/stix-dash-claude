ALTER TABLE "SafetyHazardousSubstance"
ADD COLUMN "operatingInstructionTemplateIds" TEXT;

ALTER TABLE "SafetyDataSheet"
ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'SDB';

CREATE INDEX "SafetyDataSheet_documentType_idx"
ON "SafetyDataSheet"("documentType");
