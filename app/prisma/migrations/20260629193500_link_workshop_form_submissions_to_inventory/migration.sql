ALTER TABLE "WorkshopFormSubmission" ADD COLUMN "inventoryItemId" TEXT;

CREATE INDEX "WorkshopFormSubmission_inventoryItemId_idx" ON "WorkshopFormSubmission"("inventoryItemId");
