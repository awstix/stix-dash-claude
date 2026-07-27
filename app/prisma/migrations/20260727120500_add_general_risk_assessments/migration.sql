CREATE TABLE "GeneralRiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateKey" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateTitle" TEXT NOT NULL,
    "templateRevision" TEXT NOT NULL,
    "sourcePdfPath" TEXT NOT NULL,
    "projectId" TEXT,
    "assessedEmployeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "assessmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "responsibleName" TEXT,
    "responsibleSignatureDataUrl" TEXT,
    "presenterName" TEXT,
    "presenterSignatureDataUrl" TEXT,
    "instructionTopics" TEXT,
    "notes" TEXT,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneralRiskAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GeneralRiskAssessment_assessedEmployeeId_fkey" FOREIGN KEY ("assessedEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GeneralRiskAssessmentParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyDepartment" TEXT,
    "signatureDataUrl" TEXT,
    "instructionDate" DATETIME,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneralRiskAssessmentParticipant_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "GeneralRiskAssessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneralRiskAssessmentParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GeneralRiskAssessment_templateKey_idx" ON "GeneralRiskAssessment"("templateKey");
CREATE INDEX "GeneralRiskAssessment_projectId_idx" ON "GeneralRiskAssessment"("projectId");
CREATE INDEX "GeneralRiskAssessment_assessedEmployeeId_idx" ON "GeneralRiskAssessment"("assessedEmployeeId");
CREATE INDEX "GeneralRiskAssessment_status_idx" ON "GeneralRiskAssessment"("status");
CREATE INDEX "GeneralRiskAssessment_assessmentDate_idx" ON "GeneralRiskAssessment"("assessmentDate");
CREATE INDEX "GeneralRiskAssessmentParticipant_assessmentId_idx" ON "GeneralRiskAssessmentParticipant"("assessmentId");
CREATE INDEX "GeneralRiskAssessmentParticipant_employeeId_idx" ON "GeneralRiskAssessmentParticipant"("employeeId");
CREATE INDEX "GeneralRiskAssessmentParticipant_instructionDate_idx" ON "GeneralRiskAssessmentParticipant"("instructionDate");
CREATE INDEX "GeneralRiskAssessmentParticipant_signedAt_idx" ON "GeneralRiskAssessmentParticipant"("signedAt");
CREATE UNIQUE INDEX "GeneralRiskAssessmentParticipant_assessmentId_employeeId_key" ON "GeneralRiskAssessmentParticipant"("assessmentId", "employeeId");
