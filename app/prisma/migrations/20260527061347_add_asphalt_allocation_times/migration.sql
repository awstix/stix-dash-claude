-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AsphaltLoadAllocation" (
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
    "startTime" TEXT NOT NULL DEFAULT '06:30',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
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
INSERT INTO "new_AsphaltLoadAllocation" ("asphaltDispatchEntryId", "asphaltMixName", "asphaltMixNumber", "asphaltMixTypeId", "createdAt", "driverId", "driverName", "id", "licensePlate", "longHaulEntryId", "longHaulTruckAssignmentId", "notes", "ownerType", "projectId", "projectName", "projectNumber", "shortHaulAssignmentId", "sourceType", "subcontractorName", "tonsPerTour", "totalTons", "tourCount", "updatedAt", "vehicleCategory", "vehicleId", "vehicleNumber", "vehicleType", "workDate") SELECT "asphaltDispatchEntryId", "asphaltMixName", "asphaltMixNumber", "asphaltMixTypeId", "createdAt", "driverId", "driverName", "id", "licensePlate", "longHaulEntryId", "longHaulTruckAssignmentId", "notes", "ownerType", "projectId", "projectName", "projectNumber", "shortHaulAssignmentId", "sourceType", "subcontractorName", "tonsPerTour", "totalTons", "tourCount", "updatedAt", "vehicleCategory", "vehicleId", "vehicleNumber", "vehicleType", "workDate" FROM "AsphaltLoadAllocation";
DROP TABLE "AsphaltLoadAllocation";
ALTER TABLE "new_AsphaltLoadAllocation" RENAME TO "AsphaltLoadAllocation";
CREATE INDEX "AsphaltLoadAllocation_workDate_idx" ON "AsphaltLoadAllocation"("workDate");
CREATE INDEX "AsphaltLoadAllocation_sourceType_idx" ON "AsphaltLoadAllocation"("sourceType");
CREATE INDEX "AsphaltLoadAllocation_asphaltDispatchEntryId_idx" ON "AsphaltLoadAllocation"("asphaltDispatchEntryId");
CREATE INDEX "AsphaltLoadAllocation_projectId_idx" ON "AsphaltLoadAllocation"("projectId");
CREATE INDEX "AsphaltLoadAllocation_asphaltMixTypeId_idx" ON "AsphaltLoadAllocation"("asphaltMixTypeId");
CREATE INDEX "AsphaltLoadAllocation_shortHaulAssignmentId_idx" ON "AsphaltLoadAllocation"("shortHaulAssignmentId");
CREATE INDEX "AsphaltLoadAllocation_longHaulEntryId_idx" ON "AsphaltLoadAllocation"("longHaulEntryId");
CREATE INDEX "AsphaltLoadAllocation_longHaulTruckAssignmentId_idx" ON "AsphaltLoadAllocation"("longHaulTruckAssignmentId");
CREATE INDEX "AsphaltLoadAllocation_vehicleId_idx" ON "AsphaltLoadAllocation"("vehicleId");
CREATE INDEX "AsphaltLoadAllocation_driverId_idx" ON "AsphaltLoadAllocation"("driverId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
