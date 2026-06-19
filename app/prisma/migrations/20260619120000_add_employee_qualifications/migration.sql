CREATE TABLE "EmployeeQualificationType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "reviewIntervalMonths" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EmployeeQualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "qualificationTypeId" TEXT NOT NULL,
    "lastReviewedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeQualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeQualification_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "EmployeeQualificationType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EmployeeQualificationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "qualificationTypeId" TEXT,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeQualificationDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeQualificationDocument_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "EmployeeQualificationType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeQualificationType_name_key" ON "EmployeeQualificationType"("name");
CREATE INDEX "EmployeeQualificationType_category_idx" ON "EmployeeQualificationType"("category");
CREATE INDEX "EmployeeQualificationType_isActive_idx" ON "EmployeeQualificationType"("isActive");
CREATE INDEX "EmployeeQualificationType_sortOrder_idx" ON "EmployeeQualificationType"("sortOrder");
CREATE UNIQUE INDEX "EmployeeQualification_employeeId_qualificationTypeId_key" ON "EmployeeQualification"("employeeId", "qualificationTypeId");
CREATE INDEX "EmployeeQualification_employeeId_idx" ON "EmployeeQualification"("employeeId");
CREATE INDEX "EmployeeQualification_qualificationTypeId_idx" ON "EmployeeQualification"("qualificationTypeId");
CREATE INDEX "EmployeeQualification_lastReviewedAt_idx" ON "EmployeeQualification"("lastReviewedAt");
CREATE INDEX "EmployeeQualificationDocument_employeeId_idx" ON "EmployeeQualificationDocument"("employeeId");
CREATE INDEX "EmployeeQualificationDocument_qualificationTypeId_idx" ON "EmployeeQualificationDocument"("qualificationTypeId");
CREATE INDEX "EmployeeQualificationDocument_uploadedAt_idx" ON "EmployeeQualificationDocument"("uploadedAt");

INSERT INTO "EmployeeQualificationType" ("id", "name", "category", "description", "reviewIntervalMonths", "isActive", "sortOrder", "updatedAt") VALUES
('qualification_driver_b', 'Führerschein B', 'DRIVER_LICENSE', 'PKW und leichte Fahrzeuge', 6, true, 10, CURRENT_TIMESTAMP),
('qualification_driver_be', 'Führerschein BE', 'DRIVER_LICENSE', 'PKW mit Anhänger', 6, true, 20, CURRENT_TIMESTAMP),
('qualification_driver_c', 'Führerschein C', 'DRIVER_LICENSE', 'LKW', 6, true, 30, CURRENT_TIMESTAMP),
('qualification_driver_ce', 'Führerschein CE', 'DRIVER_LICENSE', 'LKW mit Anhänger / Sattelzug', 6, true, 40, CURRENT_TIMESTAMP),
('qualification_machine_excavator', 'Bagger', 'MACHINE_LICENSE', 'Berechtigung zum Führen von Baggern', 6, true, 100, CURRENT_TIMESTAMP),
('qualification_machine_loader', 'Radlader', 'MACHINE_LICENSE', 'Berechtigung zum Führen von Radladern', 6, true, 110, CURRENT_TIMESTAMP),
('qualification_machine_roller', 'Walze', 'MACHINE_LICENSE', 'Berechtigung zum Führen von Walzen', 6, true, 120, CURRENT_TIMESTAMP),
('qualification_machine_forklift', 'Stapler', 'MACHINE_LICENSE', 'Staplerschein', 6, true, 130, CURRENT_TIMESTAMP),
('qualification_machine_platform', 'Hubarbeitsbühne', 'MACHINE_LICENSE', 'Berechtigung für Hubarbeitsbühnen', 6, true, 140, CURRENT_TIMESTAMP);
