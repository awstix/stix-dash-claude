ALTER TABLE "ProjectStartChecklistParticipant"
ADD COLUMN "instructionDate" DATETIME;

CREATE INDEX "ProjectStartChecklistParticipant_instructionDate_idx"
ON "ProjectStartChecklistParticipant"("instructionDate");
