CREATE TABLE "InventoryLabelTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tapeWidthMm" INTEGER NOT NULL,
    "labelLengthMm" INTEGER NOT NULL,
    "codeType" TEXT NOT NULL DEFAULT 'DATAMATRIX',
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "showBorder" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "blocksJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "InventoryLabelTemplate_tapeWidthMm_idx" ON "InventoryLabelTemplate"("tapeWidthMm");
CREATE INDEX "InventoryLabelTemplate_isDefault_idx" ON "InventoryLabelTemplate"("isDefault");
CREATE INDEX "InventoryLabelTemplate_name_idx" ON "InventoryLabelTemplate"("name");
