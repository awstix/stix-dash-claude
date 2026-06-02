-- CreateTable
CREATE TABLE "AsphaltLoadAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'SHORT',
    "asphaltDispatchEntryId" TEXT NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "asphaltMixTypeId" TEXT,
    "asphaltMixNumber" TEXT,
    "asphaltMixName" TEXT,
    "shortHaulAssignmentId" TEXT,
    "longHaulEntryId" TEXT,
    "longHaulTruckAssignmentId" TEXT,
    "ownerType" TEXT NOT NULL DEFAULT 'OWN',
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "vehicleCategory" TEXT,
    "driverId" TEXT,
    "driverName" TEXT,
    "subcontractorName" TEXT,
    "tourCount" INTEGER NOT NULL DEFAULT 1,
    "tonsPerTour" REAL NOT NULL DEFAULT 0,
    "totalTons" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsphaltLoadAllocation_asphaltDispatchEntryId_fkey" FOREIGN KEY ("asphaltDispatchEntryId") REFERENCES "AsphaltDispatchEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_asphaltMixTypeId_fkey" FOREIGN KEY ("asphaltMixTypeId") REFERENCES "AsphaltMixType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_shortHaulAssignmentId_fkey" FOREIGN KEY ("shortHaulAssignmentId") REFERENCES "ShortHaulAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_longHaulEntryId_fkey" FOREIGN KEY ("longHaulEntryId") REFERENCES "TruckLongHaulEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_longHaulTruckAssignmentId_fkey" FOREIGN KEY ("longHaulTruckAssignmentId") REFERENCES "TruckLongHaulTruckAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsphaltLoadAllocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShortHaulTour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "tourNumber" INTEGER NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "purposeType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "itemId" TEXT,
    "itemName" TEXT,
    "customPurpose" TEXT,
    "quantity" REAL,
    "quantityUnit" TEXT,
    "material" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "vehicleId" TEXT,
    CONSTRAINT "ShortHaulTour_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ShortHaulAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulTour_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulTour_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShortHaulTour" ("assignmentId", "createdAt", "customPurpose", "endTime", "id", "itemId", "itemName", "material", "notes", "projectId", "projectName", "projectNumber", "purposeType", "quantity", "quantityUnit", "startTime", "tourNumber", "updatedAt") SELECT "assignmentId", "createdAt", "customPurpose", "endTime", "id", "itemId", "itemName", "material", "notes", "projectId", "projectName", "projectNumber", "purposeType", "quantity", "quantityUnit", "startTime", "tourNumber", "updatedAt" FROM "ShortHaulTour";
DROP TABLE "ShortHaulTour";
ALTER TABLE "new_ShortHaulTour" RENAME TO "ShortHaulTour";
CREATE INDEX "ShortHaulTour_assignmentId_idx" ON "ShortHaulTour"("assignmentId");
CREATE INDEX "ShortHaulTour_projectId_idx" ON "ShortHaulTour"("projectId");
CREATE INDEX "ShortHaulTour_purposeType_idx" ON "ShortHaulTour"("purposeType");
CREATE INDEX "ShortHaulTour_itemId_idx" ON "ShortHaulTour"("itemId");
CREATE INDEX "ShortHaulTour_startTime_idx" ON "ShortHaulTour"("startTime");
CREATE INDEX "ShortHaulTour_endTime_idx" ON "ShortHaulTour"("endTime");
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleNumber" TEXT NOT NULL,
    "licensePlate" TEXT,
    "vehicleType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isSpecialVehicle" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "asphaltPayloadTons" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vehicle" ("category", "createdAt", "id", "isActive", "isSpecialVehicle", "licensePlate", "notes", "updatedAt", "vehicleNumber", "vehicleType") SELECT "category", "createdAt", "id", "isActive", "isSpecialVehicle", "licensePlate", "notes", "updatedAt", "vehicleNumber", "vehicleType" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");
CREATE UNIQUE INDEX "Vehicle_licensePlate_key" ON "Vehicle"("licensePlate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_workDate_idx" ON "AsphaltLoadAllocation"("workDate");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_sourceType_idx" ON "AsphaltLoadAllocation"("sourceType");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_asphaltDispatchEntryId_idx" ON "AsphaltLoadAllocation"("asphaltDispatchEntryId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_projectId_idx" ON "AsphaltLoadAllocation"("projectId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_asphaltMixTypeId_idx" ON "AsphaltLoadAllocation"("asphaltMixTypeId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_shortHaulAssignmentId_idx" ON "AsphaltLoadAllocation"("shortHaulAssignmentId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_longHaulEntryId_idx" ON "AsphaltLoadAllocation"("longHaulEntryId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_longHaulTruckAssignmentId_idx" ON "AsphaltLoadAllocation"("longHaulTruckAssignmentId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_vehicleId_idx" ON "AsphaltLoadAllocation"("vehicleId");

-- CreateIndex
CREATE INDEX "AsphaltLoadAllocation_driverId_idx" ON "AsphaltLoadAllocation"("driverId");
