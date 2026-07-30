ALTER TABLE "CrewTimeEmployee" ADD COLUMN "attendanceStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED_IN';

UPDATE "CrewTimeEmployee"
SET "attendanceStatus" = 'CHECKED_IN'
WHERE "isPresent" = 1;
