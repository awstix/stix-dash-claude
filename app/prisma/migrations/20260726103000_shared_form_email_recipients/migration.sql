-- Add shared email-recipient storage to existing form template systems.
ALTER TABLE "ProjectFormTemplate" ADD COLUMN "emailRecipientsJson" TEXT;
ALTER TABLE "WorkshopFormTemplate" ADD COLUMN "emailRecipientsJson" TEXT;

-- Safety form templates use the same field JSON / paper format / recipient pattern
-- as project and workshop forms.
CREATE TABLE "SafetyFormTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "fieldsJson" TEXT NOT NULL,
    "emailRecipientsJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "paperOrientation" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "SafetyFormTemplate_isActive_idx" ON "SafetyFormTemplate"("isActive");
CREATE INDEX "SafetyFormTemplate_name_idx" ON "SafetyFormTemplate"("name");
CREATE INDEX "SafetyFormTemplate_sortOrder_idx" ON "SafetyFormTemplate"("sortOrder");
