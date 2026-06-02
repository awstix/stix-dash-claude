-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TruckLongHaulTruckAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "vehicleCategory" TEXT NOT NULL,
    "driverId" TEXT,
    "driverName" TEXT,
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "subcontractorName" TEXT,
    "notes" TEXT,
    "plannedTourCount" INTEGER NOT NULL DEFAULT 0,
    "plannedTonsPerTour" REAL NOT NULL DEFAULT 0,
    "plannedTotalTons" REAL NOT NULL DEFAULT 0,
    "plannedStartTime" TEXT NOT NULL DEFAULT '06:30',
    "plannedEndTime" TEXT NOT NULL DEFAULT '17:00',
    "plannedNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TruckLongHaulTruckAssignment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TruckLongHaulEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulTruckAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulTruckAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TruckLongHaulTruckAssignment" ("createdAt", "driverId", "driverName", "entryId", "id", "licensePlate", "notes", "ownerType", "subcontractorName", "updatedAt", "vehicleCategory", "vehicleId", "vehicleNumber", "vehicleType") SELECT "createdAt", "driverId", "driverName", "entryId", "id", "licensePlate", "notes", "ownerType", "subcontractorName", "updatedAt", "vehicleCategory", "vehicleId", "vehicleNumber", "vehicleType" FROM "TruckLongHaulTruckAssignment";
DROP TABLE "TruckLongHaulTruckAssignment";
ALTER TABLE "new_TruckLongHaulTruckAssignment" RENAME TO "TruckLongHaulTruckAssignment";
CREATE INDEX "TruckLongHaulTruckAssignment_entryId_idx" ON "TruckLongHaulTruckAssignment"("entryId");
CREATE INDEX "TruckLongHaulTruckAssignment_ownerType_idx" ON "TruckLongHaulTruckAssignment"("ownerType");
CREATE INDEX "TruckLongHaulTruckAssignment_vehicleCategory_idx" ON "TruckLongHaulTruckAssignment"("vehicleCategory");
CREATE INDEX "TruckLongHaulTruckAssignment_driverId_idx" ON "TruckLongHaulTruckAssignment"("driverId");
CREATE INDEX "TruckLongHaulTruckAssignment_vehicleId_idx" ON "TruckLongHaulTruckAssignment"("vehicleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
