-- Migration: Add WebhookEvent table for idempotency (without Redis)
-- Purpose: Track processed webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL UNIQUE,
  "source" TEXT NOT NULL, -- 'stripe', 'other'
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'processed', 'failed'
  "payload" JSONB,
  "error" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

-- Index for fast lookup by eventId
CREATE INDEX IF NOT EXISTS "WebhookEvent_eventId_idx" ON "WebhookEvent"("eventId");

-- Index for cleanup of expired events
CREATE INDEX IF NOT EXISTS "WebhookEvent_expiresAt_idx" ON "WebhookEvent"("expiresAt");

-- Index for monitoring
CREATE INDEX IF NOT EXISTS "WebhookEvent_source_status_idx" ON "WebhookEvent"("source", "status");
