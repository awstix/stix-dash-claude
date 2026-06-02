/*
  Warnings:

  - You are about to drop the `TruckLongHaulVehicleNeed` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "TruckLongHaulVehicleNeed_entryId_ownerType_vehicleCategory_key";

-- DropIndex
DROP INDEX "TruckLongHaulVehicleNeed_vehicleCategory_idx";

-- DropIndex
DROP INDEX "TruckLongHaulVehicleNeed_ownerType_idx";

-- DropIndex
DROP INDEX "TruckLongHaulVehicleNeed_entryId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TruckLongHaulVehicleNeed";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DriverVehicleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DriverVehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriverVehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShortHaulAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '07:00',
    "truckLongHaulEntryId" TEXT,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "vehicleCategory" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "material" TEXT,
    "notes" TEXT,
    "allowLongHaulConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortHaulAssignment_truckLongHaulEntryId_fkey" FOREIGN KEY ("truckLongHaulEntryId") REFERENCES "TruckLongHaulEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShortHaulAssignment" ("createdAt", "driverId", "driverName", "id", "licensePlate", "material", "notes", "projectId", "projectName", "projectNumber", "startTime", "updatedAt", "vehicleId", "vehicleNumber", "vehicleType", "workDate") SELECT "createdAt", "driverId", "driverName", "id", "licensePlate", "material", "notes", "projectId", "projectName", "projectNumber", "startTime", "updatedAt", "vehicleId", "vehicleNumber", "vehicleType", "workDate" FROM "ShortHaulAssignment";
DROP TABLE "ShortHaulAssignment";
ALTER TABLE "new_ShortHaulAssignment" RENAME TO "ShortHaulAssignment";
CREATE INDEX "ShortHaulAssignment_workDate_idx" ON "ShortHaulAssignment"("workDate");
CREATE INDEX "ShortHaulAssignment_truckLongHaulEntryId_idx" ON "ShortHaulAssignment"("truckLongHaulEntryId");
CREATE INDEX "ShortHaulAssignment_projectId_idx" ON "ShortHaulAssignment"("projectId");
CREATE INDEX "ShortHaulAssignment_vehicleId_idx" ON "ShortHaulAssignment"("vehicleId");
CREATE INDEX "ShortHaulAssignment_driverId_idx" ON "ShortHaulAssignment"("driverId");
CREATE TABLE "new_SpecialVehicleTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "vehicleId" TEXT,
    "vehicleName" TEXT NOT NULL,
    "taskText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialVehicleTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SpecialVehicleTask" ("createdAt", "id", "taskText", "updatedAt", "vehicleName", "workDate") SELECT "createdAt", "id", "taskText", "updatedAt", "vehicleName", "workDate" FROM "SpecialVehicleTask";
DROP TABLE "SpecialVehicleTask";
ALTER TABLE "new_SpecialVehicleTask" RENAME TO "SpecialVehicleTask";
CREATE INDEX "SpecialVehicleTask_workDate_idx" ON "SpecialVehicleTask"("workDate");
CREATE INDEX "SpecialVehicleTask_vehicleId_idx" ON "SpecialVehicleTask"("vehicleId");
CREATE INDEX "SpecialVehicleTask_vehicleName_idx" ON "SpecialVehicleTask"("vehicleName");
CREATE TABLE "new_TruckLongHaulEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "assignmentType" TEXT NOT NULL DEFAULT 'CONSTRUCTION',
    "asphaltCrew" TEXT,
    "asphaltDispatchEntryId" TEXT,
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
    CONSTRAINT "TruckLongHaulEntry_asphaltDispatchEntryId_fkey" FOREIGN KEY ("asphaltDispatchEntryId") REFERENCES "AsphaltDispatchEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulEntry_materialTypeId_fkey" FOREIGN KEY ("materialTypeId") REFERENCES "MaterialType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TruckLongHaulEntry" ("asphaltCrew", "assignmentType", "constructionManager", "createdAt", "id", "materialName", "materialQuantity", "materialTypeId", "materialUnit", "notes", "projectId", "projectName", "projectNumber", "updatedAt", "workDate") SELECT "asphaltCrew", "assignmentType", "constructionManager", "createdAt", "id", "materialName", "materialQuantity", "materialTypeId", "materialUnit", "notes", "projectId", "projectName", "projectNumber", "updatedAt", "workDate" FROM "TruckLongHaulEntry";
DROP TABLE "TruckLongHaulEntry";
ALTER TABLE "new_TruckLongHaulEntry" RENAME TO "TruckLongHaulEntry";
CREATE INDEX "TruckLongHaulEntry_workDate_idx" ON "TruckLongHaulEntry"("workDate");
CREATE INDEX "TruckLongHaulEntry_assignmentType_idx" ON "TruckLongHaulEntry"("assignmentType");
CREATE INDEX "TruckLongHaulEntry_asphaltCrew_idx" ON "TruckLongHaulEntry"("asphaltCrew");
CREATE INDEX "TruckLongHaulEntry_asphaltDispatchEntryId_idx" ON "TruckLongHaulEntry"("asphaltDispatchEntryId");
CREATE INDEX "TruckLongHaulEntry_projectId_idx" ON "TruckLongHaulEntry"("projectId");
CREATE INDEX "TruckLongHaulEntry_materialTypeId_idx" ON "TruckLongHaulEntry"("materialTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_driverId_idx" ON "DriverVehicleAssignment"("driverId");

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_vehicleId_idx" ON "DriverVehicleAssignment"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverVehicleAssignment_driverId_vehicleId_key" ON "DriverVehicleAssignment"("driverId", "vehicleId");
