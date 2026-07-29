ALTER TABLE "LeaveRequest" ADD COLUMN "requestType" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "LeaveRequest" ADD COLUMN "originalRequestId" TEXT;

CREATE INDEX "LeaveRequest_originalRequestId_idx" ON "LeaveRequest"("originalRequestId");
