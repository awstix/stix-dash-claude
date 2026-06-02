-- Anspritzmittel-Tank und separate Kurzstrecken-Zuteilungen
ALTER TABLE "Vehicle" ADD COLUMN "tackCoatTankLiters" REAL NOT NULL DEFAULT 0;

ALTER TABLE "SpecialVehicleDispatchAssignment" ADD COLUMN "transportVehicleId" TEXT REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialVehicleDispatchAssignment" ADD COLUMN "transportVehicleName" TEXT;
ALTER TABLE "SpecialVehicleDispatchAssignment" ADD COLUMN "operatorDriverId" TEXT REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialVehicleDispatchAssignment" ADD COLUMN "operatorDriverName" TEXT;

CREATE TABLE "TackCoatLoadAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'SHORT',
    "asphaltDispatchEntryId" TEXT,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "tackCoatMaterialTypeId" TEXT,
    "materialName" TEXT NOT NULL DEFAULT '',
    "quantityUnit" TEXT NOT NULL DEFAULT 'l',
    "shortHaulAssignmentId" TEXT,
    "ownerType" TEXT NOT NULL DEFAULT 'OWN',
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "vehicleCategory" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "tourCount" INTEGER NOT NULL DEFAULT 1,
    "litersPerTour" REAL NOT NULL DEFAULT 0,
    "totalLiters" REAL NOT NULL DEFAULT 0,
    "startTime" TEXT NOT NULL DEFAULT '06:30',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TackCoatLoadAllocation_asphaltDispatchEntryId_fkey" FOREIGN KEY ("asphaltDispatchEntryId") REFERENCES "AsphaltDispatchEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TackCoatLoadAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TackCoatLoadAllocation_tackCoatMaterialTypeId_fkey" FOREIGN KEY ("tackCoatMaterialTypeId") REFERENCES "MaterialType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TackCoatLoadAllocation_shortHaulAssignmentId_fkey" FOREIGN KEY ("shortHaulAssignmentId") REFERENCES "ShortHaulAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TackCoatLoadAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TackCoatLoadAllocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SpecialVehicleDispatchAssignment_transportVehicleId_idx" ON "SpecialVehicleDispatchAssignment"("transportVehicleId");
CREATE INDEX "SpecialVehicleDispatchAssignment_operatorDriverId_idx" ON "SpecialVehicleDispatchAssignment"("operatorDriverId");
CREATE INDEX "TackCoatLoadAllocation_workDate_idx" ON "TackCoatLoadAllocation"("workDate");
CREATE INDEX "TackCoatLoadAllocation_sourceType_idx" ON "TackCoatLoadAllocation"("sourceType");
CREATE INDEX "TackCoatLoadAllocation_asphaltDispatchEntryId_idx" ON "TackCoatLoadAllocation"("asphaltDispatchEntryId");
CREATE INDEX "TackCoatLoadAllocation_projectId_idx" ON "TackCoatLoadAllocation"("projectId");
CREATE INDEX "TackCoatLoadAllocation_tackCoatMaterialTypeId_idx" ON "TackCoatLoadAllocation"("tackCoatMaterialTypeId");
CREATE INDEX "TackCoatLoadAllocation_shortHaulAssignmentId_idx" ON "TackCoatLoadAllocation"("shortHaulAssignmentId");
CREATE INDEX "TackCoatLoadAllocation_vehicleId_idx" ON "TackCoatLoadAllocation"("vehicleId");
CREATE INDEX "TackCoatLoadAllocation_driverId_idx" ON "TackCoatLoadAllocation"("driverId");
