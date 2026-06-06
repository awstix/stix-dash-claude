ALTER TABLE "ProjectPhoto" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "ProjectPhoto" ADD COLUMN "uploadedByName" TEXT;

CREATE INDEX "ProjectPhoto_uploadedByUserId_idx" ON "ProjectPhoto"("uploadedByUserId");
