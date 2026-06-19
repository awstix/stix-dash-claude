ALTER TABLE "EmployeeQualificationDocument" ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'OTHER';

CREATE INDEX "EmployeeQualificationDocument_documentType_idx" ON "EmployeeQualificationDocument"("documentType");
