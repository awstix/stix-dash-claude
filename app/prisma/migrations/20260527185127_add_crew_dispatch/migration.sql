-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "typeValue" TEXT,
    "typeLabel" TEXT,
    "colorClass" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crewId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewMember_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewDefaultVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crewId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewDefaultVehicle_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewDefaultVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewPlanningRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "rowTitle" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewPlanningRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewPlanningAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowId" TEXT NOT NULL,
    "crewId" TEXT,
    "crewName" TEXT NOT NULL DEFAULT '',
    "crewTypeValue" TEXT,
    "crewTypeLabel" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '06:30',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewPlanningAssignment_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "CrewPlanningRow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewPlanningAssignment_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewPlanningAssignmentEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'EXTRA',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewPlanningAssignmentEmployee_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CrewPlanningAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewPlanningAssignmentEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewPlanningAssignmentVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'EXTRA',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewPlanningAssignmentVehicle_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CrewPlanningAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewPlanningAssignmentVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Crew_name_idx" ON "Crew"("name");

-- CreateIndex
CREATE INDEX "Crew_typeValue_idx" ON "Crew"("typeValue");

-- CreateIndex
CREATE INDEX "Crew_isActive_idx" ON "Crew"("isActive");

-- CreateIndex
CREATE INDEX "CrewMember_crewId_idx" ON "CrewMember"("crewId");

-- CreateIndex
CREATE INDEX "CrewMember_employeeId_idx" ON "CrewMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_crewId_employeeId_key" ON "CrewMember"("crewId", "employeeId");

-- CreateIndex
CREATE INDEX "CrewDefaultVehicle_crewId_idx" ON "CrewDefaultVehicle"("crewId");

-- CreateIndex
CREATE INDEX "CrewDefaultVehicle_vehicleId_idx" ON "CrewDefaultVehicle"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewDefaultVehicle_crewId_vehicleId_key" ON "CrewDefaultVehicle"("crewId", "vehicleId");

-- CreateIndex
CREATE INDEX "CrewPlanningRow_weekStart_idx" ON "CrewPlanningRow"("weekStart");

-- CreateIndex
CREATE INDEX "CrewPlanningRow_projectId_idx" ON "CrewPlanningRow"("projectId");

-- CreateIndex
CREATE INDEX "CrewPlanningRow_sortOrder_idx" ON "CrewPlanningRow"("sortOrder");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignment_rowId_idx" ON "CrewPlanningAssignment"("rowId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignment_crewId_idx" ON "CrewPlanningAssignment"("crewId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignment_startDate_idx" ON "CrewPlanningAssignment"("startDate");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignment_endDate_idx" ON "CrewPlanningAssignment"("endDate");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentEmployee_assignmentId_idx" ON "CrewPlanningAssignmentEmployee"("assignmentId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentEmployee_employeeId_idx" ON "CrewPlanningAssignmentEmployee"("employeeId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentEmployee_mode_idx" ON "CrewPlanningAssignmentEmployee"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "CrewPlanningAssignmentEmployee_assignmentId_employeeId_mode_key" ON "CrewPlanningAssignmentEmployee"("assignmentId", "employeeId", "mode");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentVehicle_assignmentId_idx" ON "CrewPlanningAssignmentVehicle"("assignmentId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentVehicle_vehicleId_idx" ON "CrewPlanningAssignmentVehicle"("vehicleId");

-- CreateIndex
CREATE INDEX "CrewPlanningAssignmentVehicle_mode_idx" ON "CrewPlanningAssignmentVehicle"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "CrewPlanningAssignmentVehicle_assignmentId_vehicleId_mode_key" ON "CrewPlanningAssignmentVehicle"("assignmentId", "vehicleId", "mode");
