-- CreateTable
CREATE TABLE "TruckLongHaulTruckAssignment" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TruckLongHaulTruckAssignment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TruckLongHaulEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulTruckAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TruckLongHaulTruckAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TruckLongHaulTruckAssignment_entryId_idx" ON "TruckLongHaulTruckAssignment"("entryId");

-- CreateIndex
CREATE INDEX "TruckLongHaulTruckAssignment_ownerType_idx" ON "TruckLongHaulTruckAssignment"("ownerType");

-- CreateIndex
CREATE INDEX "TruckLongHaulTruckAssignment_vehicleCategory_idx" ON "TruckLongHaulTruckAssignment"("vehicleCategory");

-- CreateIndex
CREATE INDEX "TruckLongHaulTruckAssignment_driverId_idx" ON "TruckLongHaulTruckAssignment"("driverId");

-- CreateIndex
CREATE INDEX "TruckLongHaulTruckAssignment_vehicleId_idx" ON "TruckLongHaulTruckAssignment"("vehicleId");
