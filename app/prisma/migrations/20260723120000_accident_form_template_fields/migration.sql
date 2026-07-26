-- AlterTable
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "employeeSalutation" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "internalEmployeeStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "externalCompany" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "apprenticeStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "externalCauserStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "externalCauserName" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "policeReportStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "policeReportNotes" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "departmentCrew" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "constructionManagerName" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "constructionManagerSalutation" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "constructionManagerPhone" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "clientSafetyContact" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "injurySeverity" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "treatment" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "propertyDamageStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "propertyDamageDescription" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "externalSafetyAnalysisStatus" TEXT;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "signatureDate" DATETIME;
ALTER TABLE "SafetyAccidentReport" ADD COLUMN "managerSignatureDataUrl" TEXT;

-- CreateTable
CREATE TABLE "SafetyAccidentOfficer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SafetyAccidentNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accidentReportId" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyAccidentNotification_accidentReportId_fkey" FOREIGN KEY ("accidentReportId") REFERENCES "SafetyAccidentReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SafetyAccidentOfficer_email_key" ON "SafetyAccidentOfficer"("email");

-- CreateIndex
CREATE INDEX "SafetyAccidentOfficer_isActive_idx" ON "SafetyAccidentOfficer"("isActive");

-- CreateIndex
CREATE INDEX "SafetyAccidentNotification_accidentReportId_idx" ON "SafetyAccidentNotification"("accidentReportId");

-- CreateIndex
CREATE INDEX "SafetyAccidentNotification_recipientEmail_idx" ON "SafetyAccidentNotification"("recipientEmail");

-- CreateIndex
CREATE INDEX "SafetyAccidentNotification_status_idx" ON "SafetyAccidentNotification"("status");
