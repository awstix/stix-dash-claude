-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Crew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "typeValue" TEXT,
    "typeLabel" TEXT,
    "colorClass" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAsphaltDispatchCrew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Crew" ("colorClass", "createdAt", "id", "isActive", "name", "notes", "sortOrder", "typeLabel", "typeValue", "updatedAt") SELECT "colorClass", "createdAt", "id", "isActive", "name", "notes", "sortOrder", "typeLabel", "typeValue", "updatedAt" FROM "Crew";
DROP TABLE "Crew";
ALTER TABLE "new_Crew" RENAME TO "Crew";
CREATE INDEX "Crew_name_idx" ON "Crew"("name");
CREATE INDEX "Crew_typeValue_idx" ON "Crew"("typeValue");
CREATE INDEX "Crew_isActive_idx" ON "Crew"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
