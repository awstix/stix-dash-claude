CREATE TABLE "InventoryInitialTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "testNumber" TEXT,
    "densityTonPerCubicMeter" REAL,
    "description" TEXT,
    "notes" TEXT,
    "pdfFileName" TEXT,
    "pdfOriginalName" TEXT,
    "pdfUrl" TEXT,
    "pdfMimeType" TEXT,
    "pdfSizeBytes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "InventoryInitialTest_productCode_idx"
ON "InventoryInitialTest"("productCode");

CREATE INDEX "InventoryInitialTest_productName_idx"
ON "InventoryInitialTest"("productName");

CREATE INDEX "InventoryInitialTest_category_idx"
ON "InventoryInitialTest"("category");

CREATE INDEX "InventoryInitialTest_validUntil_idx"
ON "InventoryInitialTest"("validUntil");

CREATE INDEX "InventoryInitialTest_isActive_idx"
ON "InventoryInitialTest"("isActive");
