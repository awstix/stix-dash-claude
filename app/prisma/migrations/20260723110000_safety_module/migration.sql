-- CreateTable
CREATE TABLE "SafetyAccidentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "employeeId" TEXT,
    "reportDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accidentDate" DATETIME NOT NULL,
    "accidentTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reportedByName" TEXT,
    "projectSnapshot" TEXT,
    "employeeSnapshot" TEXT,
    "location" TEXT,
    "accidentType" TEXT,
    "bodyPart" TEXT,
    "injuryType" TEXT,
    "description" TEXT,
    "immediateMeasures" TEXT,
    "witnessNames" TEXT,
    "doctorVisit" BOOLEAN NOT NULL DEFAULT false,
    "workStopped" BOOLEAN NOT NULL DEFAULT false,
    "emergencyCalled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyAccidentReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SafetyAccidentReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SafetyAccidentPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accidentReportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedByName" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyAccidentPhoto_accidentReportId_fkey" FOREIGN KEY ("accidentReportId") REFERENCES "SafetyAccidentReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SafetyInstructionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SafetyInstructionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "projectId" TEXT,
    "instructionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instructedByName" TEXT,
    "projectSnapshot" TEXT,
    "checkedSectionsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyInstructionRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SafetyInstructionTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SafetyInstructionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SafetyInstructionSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "signatureDataUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyInstructionSignature_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SafetyInstructionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SafetyInstructionSignature_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SafetyAccidentReport_projectId_idx" ON "SafetyAccidentReport"("projectId");

-- CreateIndex
CREATE INDEX "SafetyAccidentReport_employeeId_idx" ON "SafetyAccidentReport"("employeeId");

-- CreateIndex
CREATE INDEX "SafetyAccidentReport_accidentDate_idx" ON "SafetyAccidentReport"("accidentDate");

-- CreateIndex
CREATE INDEX "SafetyAccidentReport_status_idx" ON "SafetyAccidentReport"("status");

-- CreateIndex
CREATE INDEX "SafetyAccidentPhoto_accidentReportId_idx" ON "SafetyAccidentPhoto"("accidentReportId");

-- CreateIndex
CREATE INDEX "SafetyAccidentPhoto_uploadedAt_idx" ON "SafetyAccidentPhoto"("uploadedAt");

-- CreateIndex
CREATE INDEX "SafetyInstructionTemplate_type_idx" ON "SafetyInstructionTemplate"("type");

-- CreateIndex
CREATE INDEX "SafetyInstructionTemplate_isActive_idx" ON "SafetyInstructionTemplate"("isActive");

-- CreateIndex
CREATE INDEX "SafetyInstructionTemplate_sortOrder_idx" ON "SafetyInstructionTemplate"("sortOrder");

-- CreateIndex
CREATE INDEX "SafetyInstructionRecord_templateId_idx" ON "SafetyInstructionRecord"("templateId");

-- CreateIndex
CREATE INDEX "SafetyInstructionRecord_projectId_idx" ON "SafetyInstructionRecord"("projectId");

-- CreateIndex
CREATE INDEX "SafetyInstructionRecord_instructionDate_idx" ON "SafetyInstructionRecord"("instructionDate");

-- CreateIndex
CREATE INDEX "SafetyInstructionRecord_status_idx" ON "SafetyInstructionRecord"("status");

-- CreateIndex
CREATE INDEX "SafetyInstructionSignature_recordId_idx" ON "SafetyInstructionSignature"("recordId");

-- CreateIndex
CREATE INDEX "SafetyInstructionSignature_employeeId_idx" ON "SafetyInstructionSignature"("employeeId");

-- CreateIndex
CREATE INDEX "SafetyInstructionSignature_signedAt_idx" ON "SafetyInstructionSignature"("signedAt");
