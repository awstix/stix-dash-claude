ALTER TABLE "InventoryCategory" ADD COLUMN "useInEmployeeFile" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "InventoryCategory_useInEmployeeFile_idx" ON "InventoryCategory"("useInEmployeeFile");
