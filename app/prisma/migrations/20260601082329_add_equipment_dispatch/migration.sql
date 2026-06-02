-- CreateTable
CREATE TABLE "EquipmentDispatchAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentDispatchAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentDispatchAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentDispatchAssignment_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EquipmentDispatchAssignment_vehicleId_idx" ON "EquipmentDispatchAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "EquipmentDispatchAssignment_projectId_idx" ON "EquipmentDispatchAssignment"("projectId");

-- CreateIndex
CREATE INDEX "EquipmentDispatchAssignment_crewId_idx" ON "EquipmentDispatchAssignment"("crewId");

-- CreateIndex
CREATE INDEX "EquipmentDispatchAssignment_startDate_idx" ON "EquipmentDispatchAssignment"("startDate");

-- CreateIndex
CREATE INDEX "EquipmentDispatchAssignment_endDate_idx" ON "EquipmentDispatchAssignment"("endDate");
