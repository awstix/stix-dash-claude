-- CreateTable
CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "noteDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "includeInDailyReport" BOOLEAN NOT NULL DEFAULT true,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_idx" ON "ProjectNote"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNote_noteDate_idx" ON "ProjectNote"("noteDate");

-- CreateIndex
CREATE INDEX "ProjectNote_category_idx" ON "ProjectNote"("category");

-- CreateIndex
CREATE INDEX "ProjectNote_includeInDailyReport_idx" ON "ProjectNote"("includeInDailyReport");

-- CreateIndex
CREATE INDEX "ProjectNote_visibility_idx" ON "ProjectNote"("visibility");

-- Seed existing project file notes into the new structured note list.
INSERT INTO "ProjectNote" (
    "id",
    "projectId",
    "noteDate",
    "category",
    "title",
    "content",
    "visibility",
    "includeInDailyReport",
    "createdByName",
    "createdAt",
    "updatedAt"
)
SELECT
    lower(hex(randomblob(12))),
    "id",
    CURRENT_TIMESTAMP,
    'GENERAL',
    'Projektakte',
    "notes",
    'DISPATCH',
    true,
    'Übernahme Projektakte',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project"
WHERE "notes" IS NOT NULL AND trim("notes") <> '';
