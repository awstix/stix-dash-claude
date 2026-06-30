CREATE TABLE "EmployeeTrainingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT,
    "provider" TEXT,
    "topic" TEXT NOT NULL,
    "type" TEXT,
    "defaultLocation" TEXT,
    "defaultDurationDays" REAL,
    "defaultValidityMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EmployeeTrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "trainingTypeId" TEXT,
    "number" TEXT,
    "provider" TEXT,
    "topic" TEXT NOT NULL,
    "trainingDate" DATETIME,
    "type" TEXT,
    "location" TEXT,
    "durationDays" REAL,
    "bookedAt" DATETIME,
    "bookingConfirmedAt" DATETIME,
    "certificateReceivedAt" DATETIME,
    "validityMonths" INTEGER,
    "validUntil" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeTrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeTrainingRecord_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "EmployeeTrainingType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeTrainingType_topic_key" ON "EmployeeTrainingType"("topic");
CREATE INDEX "EmployeeTrainingType_number_idx" ON "EmployeeTrainingType"("number");
CREATE INDEX "EmployeeTrainingType_isActive_idx" ON "EmployeeTrainingType"("isActive");
CREATE INDEX "EmployeeTrainingType_sortOrder_idx" ON "EmployeeTrainingType"("sortOrder");
CREATE INDEX "EmployeeTrainingRecord_employeeId_idx" ON "EmployeeTrainingRecord"("employeeId");
CREATE INDEX "EmployeeTrainingRecord_trainingTypeId_idx" ON "EmployeeTrainingRecord"("trainingTypeId");
CREATE INDEX "EmployeeTrainingRecord_trainingDate_idx" ON "EmployeeTrainingRecord"("trainingDate");
CREATE INDEX "EmployeeTrainingRecord_validUntil_idx" ON "EmployeeTrainingRecord"("validUntil");
CREATE INDEX "EmployeeTrainingRecord_topic_idx" ON "EmployeeTrainingRecord"("topic");
