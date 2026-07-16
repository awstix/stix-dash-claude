CREATE TABLE "ControllingPerformanceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "contractValueNetCents" INTEGER NOT NULL DEFAULT 0,
    "changeOrdersNetCents" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" REAL NOT NULL DEFAULT 0,
    "paymentsNetCents" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingPerformanceReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ControllingDetailEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "costType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'Stk.',
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'geschätzt',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "notes" TEXT,
    "inventoryItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingDetailEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ControllingPerformanceReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingDetailEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingDetailEntry_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ControllingHourEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT,
    "entryDate" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TEXT,
    "endsAt" TEXT,
    "breakHours" REAL NOT NULL DEFAULT 0,
    "employeeCount" REAL NOT NULL DEFAULT 1,
    "hoursPerEmployee" REAL NOT NULL DEFAULT 0,
    "totalHours" REAL NOT NULL DEFAULT 0,
    "realRateCents" INTEGER NOT NULL DEFAULT 0,
    "internalRateCents" INTEGER NOT NULL DEFAULT 0,
    "realCostCents" INTEGER NOT NULL DEFAULT 0,
    "internalCostCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingHourEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ControllingPerformanceReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingHourEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingHourEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ControllingInvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "positionCode" TEXT,
    "shortText" TEXT NOT NULL,
    "unit" TEXT,
    "contractQuantity" REAL,
    "billedQuantity" REAL NOT NULL DEFAULT 0,
    "hoursPerUnit" REAL,
    "billedHours" REAL NOT NULL DEFAULT 0,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "costPerUnitCents" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingInvoiceItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ControllingPerformanceReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingInvoiceItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ControllingEmployeeGroupRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "realRateCents" INTEGER NOT NULL DEFAULT 0,
    "internalRateCents" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "visibilityLevel" TEXT NOT NULL DEFAULT 'CONTROLLING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ControllingEmployeeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "realRateCents" INTEGER NOT NULL DEFAULT 0,
    "internalRateCents" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "visibilityLevel" TEXT NOT NULL DEFAULT 'CONTROLLING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingEmployeeRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ControllingPerformanceReport_projectId_idx" ON "ControllingPerformanceReport"("projectId");
CREATE INDEX "ControllingPerformanceReport_reportDate_idx" ON "ControllingPerformanceReport"("reportDate");
CREATE INDEX "ControllingPerformanceReport_status_idx" ON "ControllingPerformanceReport"("status");

CREATE INDEX "ControllingDetailEntry_reportId_idx" ON "ControllingDetailEntry"("reportId");
CREATE INDEX "ControllingDetailEntry_projectId_idx" ON "ControllingDetailEntry"("projectId");
CREATE INDEX "ControllingDetailEntry_entryDate_idx" ON "ControllingDetailEntry"("entryDate");
CREATE INDEX "ControllingDetailEntry_costType_idx" ON "ControllingDetailEntry"("costType");
CREATE INDEX "ControllingDetailEntry_status_idx" ON "ControllingDetailEntry"("status");
CREATE INDEX "ControllingDetailEntry_source_idx" ON "ControllingDetailEntry"("source");
CREATE INDEX "ControllingDetailEntry_inventoryItemId_idx" ON "ControllingDetailEntry"("inventoryItemId");

CREATE INDEX "ControllingHourEntry_reportId_idx" ON "ControllingHourEntry"("reportId");
CREATE INDEX "ControllingHourEntry_projectId_idx" ON "ControllingHourEntry"("projectId");
CREATE INDEX "ControllingHourEntry_employeeId_idx" ON "ControllingHourEntry"("employeeId");
CREATE INDEX "ControllingHourEntry_entryDate_idx" ON "ControllingHourEntry"("entryDate");
CREATE INDEX "ControllingHourEntry_source_idx" ON "ControllingHourEntry"("source");

CREATE INDEX "ControllingInvoiceItem_reportId_idx" ON "ControllingInvoiceItem"("reportId");
CREATE INDEX "ControllingInvoiceItem_projectId_idx" ON "ControllingInvoiceItem"("projectId");
CREATE INDEX "ControllingInvoiceItem_positionCode_idx" ON "ControllingInvoiceItem"("positionCode");
CREATE INDEX "ControllingInvoiceItem_source_idx" ON "ControllingInvoiceItem"("source");

CREATE UNIQUE INDEX "ControllingEmployeeGroupRate_name_key" ON "ControllingEmployeeGroupRate"("name");
CREATE INDEX "ControllingEmployeeGroupRate_isActive_idx" ON "ControllingEmployeeGroupRate"("isActive");
CREATE INDEX "ControllingEmployeeGroupRate_sortOrder_idx" ON "ControllingEmployeeGroupRate"("sortOrder");
CREATE INDEX "ControllingEmployeeGroupRate_visibilityLevel_idx" ON "ControllingEmployeeGroupRate"("visibilityLevel");

CREATE INDEX "ControllingEmployeeRate_employeeId_idx" ON "ControllingEmployeeRate"("employeeId");
CREATE INDEX "ControllingEmployeeRate_isActive_idx" ON "ControllingEmployeeRate"("isActive");
CREATE INDEX "ControllingEmployeeRate_visibilityLevel_idx" ON "ControllingEmployeeRate"("visibilityLevel");
