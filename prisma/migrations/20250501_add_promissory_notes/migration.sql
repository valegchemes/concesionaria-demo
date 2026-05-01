-- ============================================================
-- Módulo de Pagarés y Cuotas
-- Ejecutar en el editor SQL de Neon si las tablas no existen.
-- ============================================================

CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

CREATE TABLE IF NOT EXISTS "PromissoryNote" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "amount"    DECIMAL(12,2) NOT NULL,
  "currency"  TEXT NOT NULL DEFAULT 'ARS',
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate"   TIMESTAMP(3) NOT NULL,
  "notes"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "unitId"    TEXT NOT NULL REFERENCES "Unit"("id") ON DELETE CASCADE,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Installment" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "installmentNumber" INTEGER NOT NULL,
  "amount"            DECIMAL(12,2) NOT NULL,
  "dueDate"           TIMESTAMP(3) NOT NULL,
  "status"            "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promissoryNoteId"  TEXT NOT NULL REFERENCES "PromissoryNote"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "InstallmentPayment" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "amount"        DECIMAL(12,2) NOT NULL,
  "date"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method"        TEXT NOT NULL DEFAULT 'CASH',
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "installmentId" TEXT NOT NULL REFERENCES "Installment"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PromissoryNote_unitId_idx"        ON "PromissoryNote"("unitId");
CREATE INDEX IF NOT EXISTS "PromissoryNote_companyId_idx"     ON "PromissoryNote"("companyId");
CREATE INDEX IF NOT EXISTS "PromissoryNote_companyId_dueDate" ON "PromissoryNote"("companyId", "dueDate");
CREATE INDEX IF NOT EXISTS "Installment_promissoryNoteId_idx" ON "Installment"("promissoryNoteId");
CREATE INDEX IF NOT EXISTS "Installment_dueDate_status_idx"   ON "Installment"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "InstallmentPayment_installmentId" ON "InstallmentPayment"("installmentId");

-- RLS
ALTER TABLE "PromissoryNote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS tenant_isolation_promissory_note ON "PromissoryNote"
  USING ("companyId" = current_setting('app.current_company_id')::text);
