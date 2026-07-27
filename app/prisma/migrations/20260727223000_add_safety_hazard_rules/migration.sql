CREATE TABLE "SafetyHazardRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "section" TEXT,
    "text" TEXT NOT NULL,
    "implementation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "SafetyHazardRule_topic_idx" ON "SafetyHazardRule"("topic");
CREATE INDEX "SafetyHazardRule_source_idx" ON "SafetyHazardRule"("source");
