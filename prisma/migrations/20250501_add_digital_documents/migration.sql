-- ============================================================
-- Migración: Módulo de Documentación Digital
-- Ejecutar bloque por bloque en el editor de Neon
-- ============================================================

-- Bloque 1: Tipos enumerados
CREATE TYPE "DocumentType" AS ENUM ('BOLETO_COMPRAVENTA', 'RECIBO', 'CONTRATO');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'SIGNED');

-- Bloque 2: Tabla principal
CREATE TABLE "DigitalDocument" (
    "id"              TEXT NOT NULL,
    "type"            "DocumentType" NOT NULL,
    "referenceNumber" TEXT,
    "amount"          DECIMAL(12,2),
    "status"          "DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "metadata"        JSONB NOT NULL DEFAULT '{}',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "unitId"          TEXT NOT NULL,
    "leadId"          TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    CONSTRAINT "DigitalDocument_pkey" PRIMARY KEY ("id")
);

-- Bloque 3: Foreign keys
ALTER TABLE "DigitalDocument" ADD CONSTRAINT "DigitalDocument_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE;
ALTER TABLE "DigitalDocument" ADD CONSTRAINT "DigitalDocument_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE;
ALTER TABLE "DigitalDocument" ADD CONSTRAINT "DigitalDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;

-- Bloque 4: Índices
CREATE INDEX "DigitalDocument_companyId_idx" ON "DigitalDocument"("companyId");
CREATE INDEX "DigitalDocument_unitId_idx"    ON "DigitalDocument"("unitId");
CREATE INDEX "DigitalDocument_leadId_idx"    ON "DigitalDocument"("leadId");

-- Bloque 5: RLS (Row Level Security)
ALTER TABLE "DigitalDocument" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_digital_doc"
  ON "DigitalDocument"
  USING ("companyId" = current_setting('app.current_company_id', TRUE));
