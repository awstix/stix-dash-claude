-- CreateTable
CREATE TABLE "ProjectPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "notes" TEXT,
    "metadataTaken" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" DATETIME,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "gpsLatitude" REAL,
    "gpsLongitude" REAL,
    "metadataJson" TEXT,
    "availableForDailyReports" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectDailyReportPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDailyReportPhoto_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "ProjectDailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectDailyReportPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "ProjectPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectPhoto_projectId_idx" ON "ProjectPhoto"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_uploadedAt_idx" ON "ProjectPhoto"("uploadedAt");

-- CreateIndex
CREATE INDEX "ProjectPhoto_capturedAt_idx" ON "ProjectPhoto"("capturedAt");

-- CreateIndex
CREATE INDEX "ProjectPhoto_availableForDailyReports_idx" ON "ProjectPhoto"("availableForDailyReports");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDailyReportPhoto_dailyReportId_photoId_key" ON "ProjectDailyReportPhoto"("dailyReportId", "photoId");

-- CreateIndex
CREATE INDEX "ProjectDailyReportPhoto_dailyReportId_idx" ON "ProjectDailyReportPhoto"("dailyReportId");

-- CreateIndex
CREATE INDEX "ProjectDailyReportPhoto_photoId_idx" ON "ProjectDailyReportPhoto"("photoId");
