-- CreateTable
CREATE TABLE "WorkshopRepairOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT,
    "vehicleNumber" TEXT,
    "licensePlate" TEXT,
    "vehicleType" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "completedAt" DATETIME,
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkshopRepairOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_vehicleId_idx" ON "WorkshopRepairOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_status_idx" ON "WorkshopRepairOrder"("status");

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_priority_idx" ON "WorkshopRepairOrder"("priority");

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_reportedAt_idx" ON "WorkshopRepairOrder"("reportedAt");

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_plannedStart_idx" ON "WorkshopRepairOrder"("plannedStart");

-- CreateIndex
CREATE INDEX "WorkshopRepairOrder_completedAt_idx" ON "WorkshopRepairOrder"("completedAt");
