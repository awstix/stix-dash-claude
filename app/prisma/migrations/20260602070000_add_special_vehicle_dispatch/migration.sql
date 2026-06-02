-- CreateTable
CREATE TABLE "SpecialVehicleDispatchAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '07:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "vehicleId" TEXT,
    "vehicleName" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "crewId" TEXT,
    "crewName" TEXT,
    "taskText" TEXT NOT NULL DEFAULT '',
    "materialName" TEXT,
    "quantity" REAL,
    "quantityUnit" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialVehicleDispatchAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpecialVehicleDispatchAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpecialVehicleDispatchAssignment_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_workDate_idx" ON "SpecialVehicleDispatchAssignment"("workDate");

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_vehicleId_idx" ON "SpecialVehicleDispatchAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_projectId_idx" ON "SpecialVehicleDispatchAssignment"("projectId");

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_crewId_idx" ON "SpecialVehicleDispatchAssignment"("crewId");

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_startTime_idx" ON "SpecialVehicleDispatchAssignment"("startTime");

-- CreateIndex
CREATE INDEX "SpecialVehicleDispatchAssignment_endTime_idx" ON "SpecialVehicleDispatchAssignment"("endTime");
