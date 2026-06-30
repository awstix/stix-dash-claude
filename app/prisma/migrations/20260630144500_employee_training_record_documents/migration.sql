CREATE TABLE "EmployeeTrainingRecordDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedByName" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeTrainingRecordDocument_trainingRecordId_fkey" FOREIGN KEY ("trainingRecordId") REFERENCES "EmployeeTrainingRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeTrainingRecordDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EmployeeTrainingRecordDocument_trainingRecordId_idx" ON "EmployeeTrainingRecordDocument"("trainingRecordId");
CREATE INDEX "EmployeeTrainingRecordDocument_employeeId_idx" ON "EmployeeTrainingRecordDocument"("employeeId");
CREATE INDEX "EmployeeTrainingRecordDocument_uploadedAt_idx" ON "EmployeeTrainingRecordDocument"("uploadedAt");
CREATE INDEX "EmployeeTrainingRecordDocument_mimeType_idx" ON "EmployeeTrainingRecordDocument"("mimeType");
