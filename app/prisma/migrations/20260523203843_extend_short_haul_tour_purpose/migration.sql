-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShortHaulTour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "tourNumber" INTEGER NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "purposeType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "itemId" TEXT,
    "itemName" TEXT,
    "customPurpose" TEXT,
    "quantity" REAL,
    "quantityUnit" TEXT,
    "material" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortHaulTour_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ShortHaulAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulTour_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShortHaulTour" ("assignmentId", "createdAt", "endTime", "id", "material", "notes", "projectId", "projectName", "projectNumber", "startTime", "tourNumber", "updatedAt") SELECT "assignmentId", "createdAt", "endTime", "id", "material", "notes", "projectId", "projectName", "projectNumber", "startTime", "tourNumber", "updatedAt" FROM "ShortHaulTour";
DROP TABLE "ShortHaulTour";
ALTER TABLE "new_ShortHaulTour" RENAME TO "ShortHaulTour";
CREATE INDEX "ShortHaulTour_assignmentId_idx" ON "ShortHaulTour"("assignmentId");
CREATE INDEX "ShortHaulTour_projectId_idx" ON "ShortHaulTour"("projectId");
CREATE INDEX "ShortHaulTour_purposeType_idx" ON "ShortHaulTour"("purposeType");
CREATE INDEX "ShortHaulTour_itemId_idx" ON "ShortHaulTour"("itemId");
CREATE INDEX "ShortHaulTour_startTime_idx" ON "ShortHaulTour"("startTime");
CREATE INDEX "ShortHaulTour_endTime_idx" ON "ShortHaulTour"("endTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
