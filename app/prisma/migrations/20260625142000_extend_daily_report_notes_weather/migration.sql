-- Add structured BTB fields for Nachunternehmer/Sonstiges and hourly weather payloads.
ALTER TABLE "ProjectWeatherLog" ADD COLUMN "hourlyJson" TEXT;

ALTER TABLE "ProjectDailyReport" ADD COLUMN "subcontractorJson" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "otherJson" TEXT;
