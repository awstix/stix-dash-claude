ALTER TABLE "SafetyTemplateFolder" ADD COLUMN "defaultValidityMonths" INTEGER;
ALTER TABLE "SafetyInstructionRecord" ADD COLUMN "validityMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "SafetyInstructionRecord" ADD COLUMN "validUntil" DATETIME;
ALTER TABLE "ProjectStartChecklist" ADD COLUMN "validityMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "ProjectStartChecklist" ADD COLUMN "validUntil" DATETIME;
ALTER TABLE "GeneralRiskAssessment" ADD COLUMN "validityMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "GeneralRiskAssessment" ADD COLUMN "validUntil" DATETIME;
ALTER TABLE "EmployeeTrainingRecord" ADD COLUMN "safetySourceKey" TEXT;

CREATE UNIQUE INDEX "EmployeeTrainingRecord_safetySourceKey_key"
  ON "EmployeeTrainingRecord"("safetySourceKey");
CREATE INDEX "SafetyInstructionRecord_validUntil_idx"
  ON "SafetyInstructionRecord"("validUntil");
CREATE INDEX "ProjectStartChecklist_validUntil_idx"
  ON "ProjectStartChecklist"("validUntil");
CREATE INDEX "GeneralRiskAssessment_validUntil_idx"
  ON "GeneralRiskAssessment"("validUntil");

UPDATE "SafetyInstructionRecord"
SET "validUntil" = datetime("instructionDate", "+12 months")
WHERE "validUntil" IS NULL;
UPDATE "ProjectStartChecklist"
SET "validUntil" = datetime("checklistDate", "+12 months")
WHERE "validUntil" IS NULL;
UPDATE "GeneralRiskAssessment"
SET "validUntil" = datetime("assessmentDate", "+12 months")
WHERE "validUntil" IS NULL;

INSERT OR IGNORE INTO "EmployeeTrainingRecord" (
  "id", "employeeId", "topic", "trainingDate", "type", "validityMonths",
  "validUntil", "notes", "safetySourceKey", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))), s."employeeId", t."title",
  COALESCE(s."signedAt", r."instructionDate"),
  CASE
    WHEN t."type" = 'COMMISSION' THEN 'Beauftragung'
    WHEN t."type" = 'RISK_ASSESSMENT' THEN 'Gefährdungsbeurteilung'
    ELSE 'Betriebsanweisung / Unterweisung'
  END,
  12, datetime(COALESCE(s."signedAt", r."instructionDate"), "+12 months"),
  'Automatisch aus Arbeitssicherheit',
  'safety-record:' || r."id" || ':' || s."employeeId",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SafetyInstructionSignature" s
JOIN "SafetyInstructionRecord" r ON r."id" = s."recordId"
JOIN "SafetyInstructionTemplate" t ON t."id" = r."templateId"
WHERE s."employeeId" IS NOT NULL AND s."signatureDataUrl" IS NOT NULL;

INSERT OR IGNORE INTO "EmployeeTrainingRecord" (
  "id", "employeeId", "topic", "trainingDate", "type", "validityMonths",
  "validUntil", "notes", "safetySourceKey", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))), p."employeeId", a."templateTitle",
  COALESCE(p."instructionDate", a."assessmentDate"),
  'Gefährdungsbeurteilung', 12,
  datetime(COALESCE(p."instructionDate", a."assessmentDate"), "+12 months"),
  'Automatisch aus Arbeitssicherheit',
  'general-risk:' || a."id" || ':' || p."employeeId",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "GeneralRiskAssessmentParticipant" p
JOIN "GeneralRiskAssessment" a ON a."id" = p."assessmentId"
WHERE p."signatureDataUrl" IS NOT NULL;

INSERT OR IGNORE INTO "EmployeeTrainingRecord" (
  "id", "employeeId", "topic", "trainingDate", "type", "validityMonths",
  "validUntil", "notes", "safetySourceKey", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))), p."employeeId",
  'Projektstart Tiefbau / Asphaltbau',
  COALESCE(p."instructionDate", c."checklistDate"),
  'Gefährdungsbeurteilung / Unterweisung', 12,
  datetime(COALESCE(p."instructionDate", c."checklistDate"), "+12 months"),
  'Automatisch aus Arbeitssicherheit',
  'project-start:' || c."id" || ':' || p."employeeId",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProjectStartChecklistParticipant" p
JOIN "ProjectStartChecklist" c ON c."id" = p."checklistId"
WHERE p."signatureDataUrl" IS NOT NULL;
