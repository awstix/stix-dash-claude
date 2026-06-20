CREATE TABLE "WorkshopFormTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "fieldsJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "paperOrientation" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "WorkshopFormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "vehicleId" TEXT,
    "templateKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "formDate" DATETIME,
    "valuesJson" TEXT NOT NULL,
    "templateSnapshotJson" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkshopFormSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopFormTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkshopFormSubmission_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WorkshopFormTemplate_isActive_idx" ON "WorkshopFormTemplate"("isActive");
CREATE INDEX "WorkshopFormTemplate_sortOrder_idx" ON "WorkshopFormTemplate"("sortOrder");
CREATE INDEX "WorkshopFormSubmission_templateId_idx" ON "WorkshopFormSubmission"("templateId");
CREATE INDEX "WorkshopFormSubmission_vehicleId_idx" ON "WorkshopFormSubmission"("vehicleId");
CREATE INDEX "WorkshopFormSubmission_templateKind_idx" ON "WorkshopFormSubmission"("templateKind");
CREATE INDEX "WorkshopFormSubmission_formDate_idx" ON "WorkshopFormSubmission"("formDate");
CREATE INDEX "WorkshopFormSubmission_createdAt_idx" ON "WorkshopFormSubmission"("createdAt");
