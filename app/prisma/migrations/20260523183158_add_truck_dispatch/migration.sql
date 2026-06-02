-- CreateTable
CREATE TABLE "TruckLongHaulEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'CONSTRUCTION',
    "asphaltCrew" TEXT,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "constructionManager" TEXT,
    "materialTypeId" TEXT,
    "materialName" TEXT,
    "materialUnit" TEXT,
    "materialQuantity" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TruckLongHaulEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulEntry_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TruckLongHaulVehicleNeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "vehicleCategory" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TruckLongHaulVehicleNeed_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TruckLongHaulEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortHaulAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '07:00',
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "material" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortHaulAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialVehicleTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "vehicleName" TEXT NOT NULL,
    "taskText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TruckLongHaulEntry_workDate_idx" ON "TruckLongHaulEntry"("workDate");

-- CreateIndex
CREATE INDEX "TruckLongHaulEntry_assignmentType_idx" ON "TruckLongHaulEntry"("assignmentType");

-- CreateIndex
CREATE INDEX "TruckLongHaulEntry_asphaltCrew_idx" ON "TruckLongHaulEntry"("asphaltCrew");

-- CreateIndex
CREATE INDEX "TruckLongHaulEntry_projectId_idx" ON "TruckLongHaulEntry"("projectId");

-- CreateIndex
CREATE INDEX "TruckLongHaulEntry_materialTypeId_idx" ON "TruckLongHaulEntry"("materialTypeId");

-- CreateIndex
CREATE INDEX "TruckLongHaulVehicleNeed_entryId_idx" ON "TruckLongHaulVehicleNeed"("entryId");

-- CreateIndex
CREATE INDEX "TruckLongHaulVehicleNeed_ownerType_idx" ON "TruckLongHaulVehicleNeed"("ownerType");

-- CreateIndex
CREATE INDEX "TruckLongHaulVehicleNeed_vehicleCategory_idx" ON "TruckLongHaulVehicleNeed"("vehicleCategory");

-- CreateIndex
CREATE UNIQUE INDEX "TruckLongHaulVehicleNeed_entryId_ownerType_vehicleCategory_key" ON "TruckLongHaulVehicleNeed"("entryId", "ownerType", "vehicleCategory");

-- CreateIndex
CREATE INDEX "ShortHaulAssignment_workDate_idx" ON "ShortHaulAssignment"("workDate");

-- CreateIndex
CREATE INDEX "ShortHaulAssignment_projectId_idx" ON "ShortHaulAssignment"("projectId");

-- CreateIndex
CREATE INDEX "ShortHaulAssignment_vehicleId_idx" ON "ShortHaulAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "ShortHaulAssignment_driverId_idx" ON "ShortHaulAssignment"("driverId");

-- CreateIndex
CREATE INDEX "SpecialVehicleTask_workDate_idx" ON "SpecialVehicleTask"("workDate");

-- CreateIndex
CREATE INDEX "SpecialVehicleTask_vehicleName_idx" ON "SpecialVehicleTask"("vehicleName");
