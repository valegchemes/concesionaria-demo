-- Migration: Replace Stripe fields with Mercado Pago fields in SaasSubscription
-- Run this against your production database to apply schema changes

-- 1. Add mpPaymentId column (nullable)
ALTER TABLE "SaasSubscription" ADD COLUMN IF NOT EXISTS "mpPaymentId" TEXT;

-- 2. Create index for mpPaymentId
CREATE INDEX IF NOT EXISTS "SaasSubscription_mpPaymentId_idx" ON "SaasSubscription"("mpPaymentId");

-- 3. Drop unique constraint on stripeCustomerId (may fail if it doesn't exist - that's OK)
ALTER TABLE "SaasSubscription" DROP CONSTRAINT IF EXISTS "SaasSubscription_stripeCustomerId_key";

-- 4. Drop unique constraint on stripeSubscriptionId
ALTER TABLE "SaasSubscription" DROP CONSTRAINT IF EXISTS "SaasSubscription_stripeSubscriptionId_key";

-- 5. Drop old Stripe-specific indexes
DROP INDEX IF EXISTS "SaasSubscription_stripeCustomerId_idx";
DROP INDEX IF EXISTS "SaasSubscription_stripeSubscriptionId_idx";

-- 6. Drop old Stripe columns (safe - no longer used)
ALTER TABLE "SaasSubscription" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "SaasSubscription" DROP COLUMN IF EXISTS "stripeSubscriptionId";

-- 7. Update WebhookEvent source references (optional cleanup)
UPDATE "WebhookEvent" SET "source" = 'mercadopago' WHERE "source" = 'stripe';
