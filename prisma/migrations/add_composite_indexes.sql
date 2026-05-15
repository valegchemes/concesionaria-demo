-- Migration: Add Composite Indexes for Performance
-- Generated: 2024
-- Purpose: Optimize frequent queries with composite indexes

-- ============================================================================
-- AUDIT LOG INDEXES
-- ============================================================================

-- Query: Filter by company + resource + date range
CREATE INDEX IF NOT EXISTS "AuditLog_companyId_resource_createdAt_idx" 
ON "AuditLog"("companyId", "resource", "createdAt" DESC);

-- Query: Filter by company + user + date range
CREATE INDEX IF NOT EXISTS "AuditLog_companyId_userId_createdAt_idx" 
ON "AuditLog"("companyId", "userId", "createdAt" DESC);

-- ============================================================================
-- LEAD INDEXES
-- ============================================================================

-- Query: Filter by company + status + assigned user
CREATE INDEX IF NOT EXISTS "Lead_companyId_status_assignedToId_idx" 
ON "Lead"("companyId", "status", "assignedToId");

-- Query: List leads ordered by creation date
CREATE INDEX IF NOT EXISTS "Lead_companyId_createdAt_idx" 
ON "Lead"("companyId", "createdAt" DESC);

-- ============================================================================
-- UNIT INDEXES
-- ============================================================================

-- Query: Filter by company + status + type (catalog filtering)
CREATE INDEX IF NOT EXISTS "Unit_companyId_status_type_idx" 
ON "Unit"("companyId", "status", "type");

-- Query: Filter by company + price range
CREATE INDEX IF NOT EXISTS "Unit_companyId_priceArs_idx" 
ON "Unit"("companyId", "priceArs");

-- Query: List units ordered by creation date
CREATE INDEX IF NOT EXISTS "Unit_companyId_createdAt_idx" 
ON "Unit"("companyId", "createdAt" DESC);

-- ============================================================================
-- DEAL INDEXES
-- ============================================================================

-- Query: Filter by company + status + seller
CREATE INDEX IF NOT EXISTS "Deal_companyId_status_sellerId_idx" 
ON "Deal"("companyId", "status", "sellerId");

-- Query: List deals ordered by creation date
CREATE INDEX IF NOT EXISTS "Deal_companyId_createdAt_idx" 
ON "Deal"("companyId", "createdAt" DESC);

-- ============================================================================
-- INSTALLMENT INDEXES
-- ============================================================================

-- Query: Find overdue installments (cron job)
CREATE INDEX IF NOT EXISTS "Installment_status_dueDate_idx" 
ON "Installment"("status", "dueDate");

-- ============================================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- ============================================================================

ANALYZE "AuditLog";
ANALYZE "Lead";
ANALYZE "Unit";
ANALYZE "Deal";
ANALYZE "Installment";

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================

-- Run this query to verify all indexes were created:
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
