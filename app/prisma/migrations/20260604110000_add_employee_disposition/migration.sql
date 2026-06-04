-- CreateTable
CREATE TABLE "EmployeeDispositionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '06:30',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "typeValue" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeDispositionEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmployeeDispositionEntry_employeeId_idx" ON "EmployeeDispositionEntry"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDispositionEntry_startDate_idx" ON "EmployeeDispositionEntry"("startDate");

-- CreateIndex
CREATE INDEX "EmployeeDispositionEntry_endDate_idx" ON "EmployeeDispositionEntry"("endDate");

-- CreateIndex
CREATE INDEX "EmployeeDispositionEntry_typeValue_idx" ON "EmployeeDispositionEntry"("typeValue");
