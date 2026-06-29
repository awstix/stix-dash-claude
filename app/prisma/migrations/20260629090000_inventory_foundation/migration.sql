CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colorClass" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "inventoryNumber" TEXT,
    "constructionYear" INTEGER,
    "constructionDate" DATETIME,
    "receivedAt" DATETIME,
    "isContainer" BOOLEAN NOT NULL DEFAULT false,
    "parentItemId" TEXT,
    "isStockManaged" BOOLEAN NOT NULL DEFAULT false,
    "stockUnit" TEXT NOT NULL DEFAULT 'Stk.',
    "openingStock" REAL,
    "currentStock" REAL,
    "responsibleType" TEXT,
    "responsibleEmployeeId" TEXT,
    "responsibleCrewId" TEXT,
    "currentProjectId" TEXT,
    "vehicleId" TEXT,
    "billingRateCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_responsibleCrewId_fkey" FOREIGN KEY ("responsibleCrewId") REFERENCES "Crew" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_currentProjectId_fkey" FOREIGN KEY ("currentProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InventoryPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InventoryContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryContact_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InventoryUsageHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'ASSIGNMENT',
    "employeeId" TEXT,
    "projectId" TEXT,
    "transportedByEmployeeId" TEXT,
    "defectDescription" TEXT,
    "receivedAt" DATETIME,
    "returnedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryUsageHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryUsageHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryUsageHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryUsageHistory_transportedByEmployeeId_fkey" FOREIGN KEY ("transportedByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");
CREATE INDEX "InventoryCategory_isActive_idx" ON "InventoryCategory"("isActive");
CREATE INDEX "InventoryCategory_sortOrder_idx" ON "InventoryCategory"("sortOrder");

CREATE UNIQUE INDEX "InventoryItem_inventoryNumber_key" ON "InventoryItem"("inventoryNumber");
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");
CREATE INDEX "InventoryItem_inventoryNumber_idx" ON "InventoryItem"("inventoryNumber");
CREATE INDEX "InventoryItem_serialNumber_idx" ON "InventoryItem"("serialNumber");
CREATE INDEX "InventoryItem_isContainer_idx" ON "InventoryItem"("isContainer");
CREATE INDEX "InventoryItem_isStockManaged_idx" ON "InventoryItem"("isStockManaged");
CREATE INDEX "InventoryItem_parentItemId_idx" ON "InventoryItem"("parentItemId");
CREATE INDEX "InventoryItem_responsibleEmployeeId_idx" ON "InventoryItem"("responsibleEmployeeId");
CREATE INDEX "InventoryItem_responsibleCrewId_idx" ON "InventoryItem"("responsibleCrewId");
CREATE INDEX "InventoryItem_currentProjectId_idx" ON "InventoryItem"("currentProjectId");
CREATE INDEX "InventoryItem_vehicleId_idx" ON "InventoryItem"("vehicleId");

CREATE INDEX "InventoryPhoto_itemId_idx" ON "InventoryPhoto"("itemId");
CREATE INDEX "InventoryPhoto_createdAt_idx" ON "InventoryPhoto"("createdAt");

CREATE INDEX "InventoryContact_itemId_idx" ON "InventoryContact"("itemId");
CREATE INDEX "InventoryContact_role_idx" ON "InventoryContact"("role");

CREATE INDEX "InventoryUsageHistory_itemId_idx" ON "InventoryUsageHistory"("itemId");
CREATE INDEX "InventoryUsageHistory_eventType_idx" ON "InventoryUsageHistory"("eventType");
CREATE INDEX "InventoryUsageHistory_employeeId_idx" ON "InventoryUsageHistory"("employeeId");
CREATE INDEX "InventoryUsageHistory_projectId_idx" ON "InventoryUsageHistory"("projectId");
CREATE INDEX "InventoryUsageHistory_transportedByEmployeeId_idx" ON "InventoryUsageHistory"("transportedByEmployeeId");
CREATE INDEX "InventoryUsageHistory_receivedAt_idx" ON "InventoryUsageHistory"("receivedAt");
CREATE INDEX "InventoryUsageHistory_returnedAt_idx" ON "InventoryUsageHistory"("returnedAt");
