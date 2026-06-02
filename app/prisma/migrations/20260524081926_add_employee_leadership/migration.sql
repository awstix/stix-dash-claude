-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusValue" TEXT NOT NULL DEFAULT 'active',
    "statusLabel" TEXT NOT NULL DEFAULT 'Aktiv',
    "entryDate" DATETIME,
    "exitDate" DATETIME,
    "companyValue" TEXT,
    "companyLabel" TEXT,
    "departmentValue" TEXT,
    "departmentLabel" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isLeadership" BOOLEAN NOT NULL DEFAULT false,
    "birthDate" DATETIME,
    "genderValue" TEXT,
    "genderLabel" TEXT,
    "mobilePhone" TEXT,
    "emergencyPhone" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "driverId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("birthDate", "city", "companyLabel", "companyValue", "createdAt", "departmentLabel", "departmentValue", "driverId", "emergencyPhone", "entryDate", "exitDate", "firstName", "genderLabel", "genderValue", "id", "lastName", "mobilePhone", "notes", "postalCode", "statusLabel", "statusValue", "street", "updatedAt") SELECT "birthDate", "city", "companyLabel", "companyValue", "createdAt", "departmentLabel", "departmentValue", "driverId", "emergencyPhone", "entryDate", "exitDate", "firstName", "genderLabel", "genderValue", "id", "lastName", "mobilePhone", "notes", "postalCode", "statusLabel", "statusValue", "street", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_driverId_key" ON "Employee"("driverId");
CREATE INDEX "Employee_statusValue_idx" ON "Employee"("statusValue");
CREATE INDEX "Employee_companyValue_idx" ON "Employee"("companyValue");
CREATE INDEX "Employee_departmentValue_idx" ON "Employee"("departmentValue");
CREATE INDEX "Employee_lastName_idx" ON "Employee"("lastName");
CREATE INDEX "Employee_driverId_idx" ON "Employee"("driverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
