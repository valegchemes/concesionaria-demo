-- ============================================================================
-- RLS POLICIES para AutoManager CRM
-- 
-- Este sistema usa Prisma + NextAuth con un único usuario de base de datos
-- (DATABASE_URL). La autenticación/autorización ocurre en la capa de aplicación
-- (middleware.ts + auth-helpers.ts), NO en Supabase RLS.
--
-- Por lo tanto, necesitamos:
-- 1. DESHABILITAR RLS en todas las tablas (o asegurarnos de que hay una policy
--    que permite el acceso al rol de servicio), para que Prisma pueda leer/escribir.
-- 2. Si en el futuro se habilita RLS, las policies deben permitir acceso al
--    usuario de DATABASE_URL (normalmente el rol 'postgres' o 'authenticated').
--
-- EJECUTAR EN: Supabase SQL Editor → New Query → Run
-- ============================================================================

-- Deshabilitar RLS en todas las tablas administradas por Prisma
-- Esto permite que el service role (DATABASE_URL) acceda sin restricciones

ALTER TABLE "Company"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "User"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitAttribute"  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitCostItem"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Deal"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DealPayment"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DealCostItem"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DealTradeIn"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicClickEvent" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Role"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SaasSubscription" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyExpense" DISABLE ROW LEVEL SECURITY;

-- Verificar el estado actual de RLS en todas las tablas
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN '⚠ RLS ACTIVO' ELSE '✅ RLS desactivado' END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
