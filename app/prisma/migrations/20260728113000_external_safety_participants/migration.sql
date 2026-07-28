PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneralRiskAssessmentParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "employeeId" TEXT,
    "companyDepartment" TEXT,
    "externalFirstName" TEXT,
    "externalLastName" TEXT,
    "externalCompany" TEXT,
    "signatureDataUrl" TEXT,
    "instructionDate" DATETIME,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneralRiskAssessmentParticipant_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "GeneralRiskAssessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneralRiskAssessmentParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GeneralRiskAssessmentParticipant" ("assessmentId", "companyDepartment", "createdAt", "employeeId", "id", "instructionDate", "signatureDataUrl", "signedAt", "updatedAt")
SELECT "assessmentId", "companyDepartment", "createdAt", "employeeId", "id", "instructionDate", "signatureDataUrl", "signedAt", "updatedAt" FROM "GeneralRiskAssessmentParticipant";
DROP TABLE "GeneralRiskAssessmentParticipant";
ALTER TABLE "new_GeneralRiskAssessmentParticipant" RENAME TO "GeneralRiskAssessmentParticipant";
CREATE INDEX "GeneralRiskAssessmentParticipant_assessmentId_idx" ON "GeneralRiskAssessmentParticipant"("assessmentId");
CREATE INDEX "GeneralRiskAssessmentParticipant_employeeId_idx" ON "GeneralRiskAssessmentParticipant"("employeeId");
CREATE INDEX "GeneralRiskAssessmentParticipant_instructionDate_idx" ON "GeneralRiskAssessmentParticipant"("instructionDate");
CREATE INDEX "GeneralRiskAssessmentParticipant_signedAt_idx" ON "GeneralRiskAssessmentParticipant"("signedAt");
CREATE UNIQUE INDEX "GeneralRiskAssessmentParticipant_assessmentId_employeeId_key" ON "GeneralRiskAssessmentParticipant"("assessmentId", "employeeId");
CREATE TABLE "new_ProjectStartChecklistParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "employeeId" TEXT,
    "companyDepartment" TEXT,
    "externalFirstName" TEXT,
    "externalLastName" TEXT,
    "externalCompany" TEXT,
    "signatureDataUrl" TEXT,
    "instructionDate" DATETIME,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectStartChecklistParticipant_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ProjectStartChecklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStartChecklistParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectStartChecklistParticipant" ("checklistId", "companyDepartment", "createdAt", "employeeId", "id", "instructionDate", "signatureDataUrl", "signedAt", "updatedAt")
SELECT "checklistId", "companyDepartment", "createdAt", "employeeId", "id", "instructionDate", "signatureDataUrl", "signedAt", "updatedAt" FROM "ProjectStartChecklistParticipant";
DROP TABLE "ProjectStartChecklistParticipant";
ALTER TABLE "new_ProjectStartChecklistParticipant" RENAME TO "ProjectStartChecklistParticipant";
CREATE INDEX "ProjectStartChecklistParticipant_checklistId_idx" ON "ProjectStartChecklistParticipant"("checklistId");
CREATE INDEX "ProjectStartChecklistParticipant_employeeId_idx" ON "ProjectStartChecklistParticipant"("employeeId");
CREATE INDEX "ProjectStartChecklistParticipant_instructionDate_idx" ON "ProjectStartChecklistParticipant"("instructionDate");
CREATE INDEX "ProjectStartChecklistParticipant_signedAt_idx" ON "ProjectStartChecklistParticipant"("signedAt");
CREATE UNIQUE INDEX "ProjectStartChecklistParticipant_checklistId_employeeId_key" ON "ProjectStartChecklistParticipant"("checklistId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
