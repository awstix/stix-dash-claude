ALTER TABLE "ProjectNote" ADD COLUMN "noteEndDate" DATETIME;
CREATE INDEX "ProjectNote_noteEndDate_idx" ON "ProjectNote"("noteEndDate");
