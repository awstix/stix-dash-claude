CREATE TABLE "SafetyTemplateFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SafetyTemplateFolder_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "SafetyTemplateFolder" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SafetyTemplateFolder_area_idx"
  ON "SafetyTemplateFolder"("area");
CREATE INDEX "SafetyTemplateFolder_parentId_idx"
  ON "SafetyTemplateFolder"("parentId");
CREATE INDEX "SafetyTemplateFolder_sortOrder_idx"
  ON "SafetyTemplateFolder"("sortOrder");
CREATE UNIQUE INDEX "SafetyTemplateFolder_systemKey_key"
  ON "SafetyTemplateFolder"("systemKey");

ALTER TABLE "SafetyInstructionTemplate" ADD COLUMN "folderId" TEXT;
ALTER TABLE "SafetyInstructionTemplate" ADD COLUMN "sourcePdfPath" TEXT;
ALTER TABLE "SafetyInstructionTemplate" ADD COLUMN "sourceDocxPath" TEXT;

CREATE INDEX "SafetyInstructionTemplate_folderId_idx"
  ON "SafetyInstructionTemplate"("folderId");
