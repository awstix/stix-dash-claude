-- CreateTable
CREATE TABLE "AsphaltDispatchEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workDate" DATETIME NOT NULL,
    "crew" TEXT NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "constructionManager" TEXT,
    "asphaltMixTypeId" TEXT,
    "asphaltMixNumber" TEXT,
    "asphaltMixName" TEXT,
    "quantityTons" REAL NOT NULL DEFAULT 0,
    "isForeignMix" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsphaltDispatchEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AsphaltDispatchEntry_asphaltMixTypeId_fkey" FOREIGN KEY ("asphaltMixTypeId") REFERENCES "AsphaltMixType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AsphaltDispatchEntry_workDate_idx" ON "AsphaltDispatchEntry"("workDate");

-- CreateIndex
CREATE INDEX "AsphaltDispatchEntry_crew_idx" ON "AsphaltDispatchEntry"("crew");

-- CreateIndex
CREATE INDEX "AsphaltDispatchEntry_projectId_idx" ON "AsphaltDispatchEntry"("projectId");

-- CreateIndex
CREATE INDEX "AsphaltDispatchEntry_asphaltMixTypeId_idx" ON "AsphaltDispatchEntry"("asphaltMixTypeId");
