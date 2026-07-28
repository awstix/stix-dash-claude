ALTER TABLE "SafetyInstructionRecord" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "SafetyInstructionRecord" ADD COLUMN "previousVersionId" TEXT
  REFERENCES "SafetyInstructionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SafetyInstructionRecord_archivedAt_idx"
  ON "SafetyInstructionRecord"("archivedAt");
CREATE INDEX "SafetyInstructionRecord_previousVersionId_idx"
  ON "SafetyInstructionRecord"("previousVersionId");
