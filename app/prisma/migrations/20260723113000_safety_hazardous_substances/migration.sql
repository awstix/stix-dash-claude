-- CreateTable
CREATE TABLE "SafetyHazardousSubstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "category" TEXT,
    "usageArea" TEXT,
    "storagePlace" TEXT,
    "signalWord" TEXT,
    "hazardSymbols" TEXT,
    "hStatements" TEXT,
    "pStatements" TEXT,
    "protectiveMeasures" TEXT,
    "firstAidMeasures" TEXT,
    "disposalNotes" TEXT,
    "responsibleName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SafetyDataSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardousSubstanceId" TEXT NOT NULL,
    "versionDate" DATETIME,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedByName" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyDataSheet_hazardousSubstanceId_fkey" FOREIGN KEY ("hazardousSubstanceId") REFERENCES "SafetyHazardousSubstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SafetyHazardousSubstance_name_idx" ON "SafetyHazardousSubstance"("name");

-- CreateIndex
CREATE INDEX "SafetyHazardousSubstance_category_idx" ON "SafetyHazardousSubstance"("category");

-- CreateIndex
CREATE INDEX "SafetyHazardousSubstance_isActive_idx" ON "SafetyHazardousSubstance"("isActive");

-- CreateIndex
CREATE INDEX "SafetyDataSheet_hazardousSubstanceId_idx" ON "SafetyDataSheet"("hazardousSubstanceId");

-- CreateIndex
CREATE INDEX "SafetyDataSheet_versionDate_idx" ON "SafetyDataSheet"("versionDate");

-- CreateIndex
CREATE INDEX "SafetyDataSheet_uploadedAt_idx" ON "SafetyDataSheet"("uploadedAt");
