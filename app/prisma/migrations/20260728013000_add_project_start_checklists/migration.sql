CREATE TABLE "ProjectStartChecklist" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "templateCode" TEXT NOT NULL DEFAULT 'A-30-30-001',
  "templateRevision" TEXT NOT NULL DEFAULT '00',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "checklistDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startDate" DATETIME,
  "endDate" DATETIME,
  "siteStreet" TEXT,
  "sitePostalCity" TEXT,
  "responsibleManager" TEXT,
  "responsiblePhone" TEXT,
  "responsibleMobile" TEXT,
  "presenterName" TEXT,
  "presenterSignatureDataUrl" TEXT,
  "activitiesJson" TEXT NOT NULL DEFAULT '[]',
  "otherActivities" TEXT,
  "assessmentsJson" TEXT NOT NULL DEFAULT '{}',
  "instructionTopics" TEXT,
  "createdByName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProjectStartChecklist_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProjectStartChecklistParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checklistId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "companyDepartment" TEXT,
  "signatureDataUrl" TEXT,
  "signedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProjectStartChecklistParticipant_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "ProjectStartChecklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectStartChecklistParticipant_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectStartChecklist_projectId_idx" ON "ProjectStartChecklist"("projectId");
CREATE INDEX "ProjectStartChecklist_status_idx" ON "ProjectStartChecklist"("status");
CREATE INDEX "ProjectStartChecklist_checklistDate_idx" ON "ProjectStartChecklist"("checklistDate");
CREATE UNIQUE INDEX "ProjectStartChecklistParticipant_checklistId_employeeId_key"
ON "ProjectStartChecklistParticipant"("checklistId", "employeeId");
CREATE INDEX "ProjectStartChecklistParticipant_checklistId_idx"
ON "ProjectStartChecklistParticipant"("checklistId");
CREATE INDEX "ProjectStartChecklistParticipant_employeeId_idx"
ON "ProjectStartChecklistParticipant"("employeeId");
