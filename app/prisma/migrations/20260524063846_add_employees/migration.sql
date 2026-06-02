-- CreateTable
CREATE TABLE "Employee" (
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

-- CreateTable
CREATE TABLE "EmployeePositionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "positionValue" TEXT NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeePositionAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_driverId_key" ON "Employee"("driverId");

-- CreateIndex
CREATE INDEX "Employee_statusValue_idx" ON "Employee"("statusValue");

-- CreateIndex
CREATE INDEX "Employee_companyValue_idx" ON "Employee"("companyValue");

-- CreateIndex
CREATE INDEX "Employee_departmentValue_idx" ON "Employee"("departmentValue");

-- CreateIndex
CREATE INDEX "Employee_lastName_idx" ON "Employee"("lastName");

-- CreateIndex
CREATE INDEX "Employee_driverId_idx" ON "Employee"("driverId");

-- CreateIndex
CREATE INDEX "EmployeePositionAssignment_employeeId_idx" ON "EmployeePositionAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePositionAssignment_positionValue_idx" ON "EmployeePositionAssignment"("positionValue");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePositionAssignment_employeeId_positionValue_key" ON "EmployeePositionAssignment"("employeeId", "positionValue");
