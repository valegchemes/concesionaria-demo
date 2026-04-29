-- ============================================================
-- Row Level Security (RLS) para aislamiento multi-tenant
-- Neon/Postgres / Supabase
-- Ejecútalo en el editor SQL de tu base de datos.
-- ============================================================

-- Activar RLS en tablas que contienen companyId.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;

-- Política general de tenant
CREATE POLICY tenant_isolation_user ON "User"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_deal ON "Deal"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_lead ON "Lead"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_unit ON "Unit"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_lead_activity ON "LeadActivity"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_task ON "Task"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_audit_log ON "AuditLog"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_company_expense ON "CompanyExpense"
  USING ("companyId" = current_setting('app.current_company_id')::text);

CREATE POLICY tenant_isolation_whatsapp_template ON "WhatsAppTemplate"
  USING ("companyId" = current_setting('app.current_company_id')::text);

-- Este valor debe establecerse dentro de cada request o transacción.
-- En Prisma podrás usar:
--   await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`
-- antes de ejecutar las queries de la transacción.

-- Nota: el entorno actual del repo ya aplica tenant isolation con AsyncLocalStorage,
-- pero RLS es una segunda capa de defensa en la base de datos.
