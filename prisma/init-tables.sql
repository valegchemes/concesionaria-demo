-- ============================================================
-- Concesionaria SaaS - Script de inicialización de base de datos
-- Compatible con: Neon PostgreSQL / Supabase / PostgreSQL 15+
-- Copiar y pegar en el SQL Editor de Neon u otro cliente SQL
-- ============================================================

-- ==================== TIPOS ENUMERADOS ====================

CREATE TYPE "UserRole"       AS ENUM ('ADMIN', 'MANAGER', 'SELLER');
CREATE TYPE "Currency"       AS ENUM ('ARS', 'USD');
CREATE TYPE "UnitType"       AS ENUM ('CAR', 'MOTORCYCLE', 'BOAT');
CREATE TYPE "UnitStatus"     AS ENUM ('AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD');
CREATE TYPE "AcquisitionType" AS ENUM ('PURCHASE', 'TRADE_IN', 'CONSIGNMENT');
CREATE TYPE "LeadSource"     AS ENUM ('INSTAGRAM', 'FACEBOOK_MARKETPLACE', 'REFERRAL', 'WALK_IN', 'PHONE', 'WEBSITE', 'WHATSAPP', 'OLX', 'AUTOSUSADOS', 'OTHER');
CREATE TYPE "LeadStatus"     AS ENUM ('NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED', 'SOLD', 'LOST');
CREATE TYPE "ActivityType"   AS ENUM ('WHATSAPP_SENT', 'CALL_MADE', 'CALL_RECEIVED', 'VISIT_DONE', 'OFFER_RECEIVED', 'EMAIL_SENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'TASK_COMPLETED');
CREATE TYPE "DealStatus"     AS ENUM ('NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED');
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "PaymentMethod"  AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'FINANCING', 'CRYPTO', 'OTHER');
CREATE TYPE "ClickType"      AS ENUM ('WHATSAPP_CLICK', 'PHONE_CLICK', 'UNIT_VIEW', 'SHARE_CLICK');

-- ==================== TABLAS ====================

-- Company: Una concesionaria por row (multi-tenant raíz)
CREATE TABLE "Company" (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    "customDomain"      TEXT UNIQUE,
    email               TEXT NOT NULL,
    phone               TEXT,
    "whatsappCentral"   TEXT,
    address             TEXT,
    city                TEXT,
    "logoUrl"           TEXT,
    "currencyPreference" TEXT NOT NULL DEFAULT 'BOTH',
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User: Usuarios de la plataforma
CREATE TABLE "User" (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL,
    name            TEXT NOT NULL,
    password        TEXT NOT NULL,
    role            "UserRole" NOT NULL DEFAULT 'SELLER',
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT,
    "companyId"     TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, "companyId")
);
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- Unit: Inventario de vehículos (autos, motos, lanchas)
CREATE TABLE "Unit" (
    id                  TEXT PRIMARY KEY,
    type                "UnitType" NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    status              "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    location            TEXT,
    tags                TEXT[] DEFAULT '{}',
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    -- Precios
    "priceArs"          DECIMAL(12,2),
    "priceUsd"          DECIMAL(12,2),
    -- Identificadores únicos por tipo
    vin                 TEXT,  -- Auto
    domain              TEXT,  -- Auto (patente)
    "engineNumber"      TEXT,  -- Moto
    "frameNumber"       TEXT,  -- Moto
    hin                 TEXT,  -- Lancha
    "registrationNumber" TEXT, -- Lancha
    -- Adquisición
    "acquisitionCostArs" DECIMAL(12,2),
    "acquisitionCostUsd" DECIMAL(12,2),
    "acquisitionType"   "AcquisitionType" NOT NULL DEFAULT 'PURCHASE',
    "acquisitionDate"   TIMESTAMP(3),
    -- Permuta
    "isFromTradeIn"     BOOLEAN NOT NULL DEFAULT false,
    "tradeInId"         TEXT,
    -- Multi-tenant
    "companyId"         TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Unit_companyId_idx"        ON "Unit"("companyId");
CREATE INDEX "Unit_companyId_status_idx" ON "Unit"("companyId", status);
CREATE INDEX "Unit_companyId_type_idx"   ON "Unit"("companyId", type);

-- UnitPhoto: Fotos de unidad
CREATE TABLE "UnitPhoto" (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    url        TEXT NOT NULL,
    "order"    INTEGER NOT NULL DEFAULT 0,
    caption    TEXT,
    "unitId"   TEXT NOT NULL REFERENCES "Unit"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UnitPhoto_unitId_idx" ON "UnitPhoto"("unitId");

-- UnitAttribute: Atributos dinámicos por tipo de unidad
CREATE TABLE "UnitAttribute" (
    id       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL,
    "unitId" TEXT NOT NULL REFERENCES "Unit"(id) ON DELETE CASCADE,
    UNIQUE("unitId", key)
);
CREATE INDEX "UnitAttribute_unitId_idx" ON "UnitAttribute"("unitId");

-- UnitCostItem: Gastos de adquisición/preparación por unidad
CREATE TABLE "UnitCostItem" (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    concept      TEXT NOT NULL,
    "amountArs"  DECIMAL(12,2),
    "amountUsd"  DECIMAL(12,2),
    date         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitId"     TEXT NOT NULL REFERENCES "Unit"(id) ON DELETE CASCADE
);
CREATE INDEX "UnitCostItem_unitId_idx" ON "UnitCostItem"("unitId");

-- Lead: Prospecto / cliente potencial
CREATE TABLE "Lead" (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    email             TEXT,
    source            "LeadSource" NOT NULL DEFAULT 'OTHER',
    status            "LeadStatus" NOT NULL DEFAULT 'NEW',
    "lostReason"      TEXT,
    notes             TEXT,
    "quickInfo"       TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "companyId"       TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "assignedToId"    TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "createdById"     TEXT NOT NULL REFERENCES "User"(id),
    "interestedUnitId" TEXT REFERENCES "Unit"(id) ON DELETE SET NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Lead_companyId_idx"              ON "Lead"("companyId");
CREATE INDEX "Lead_companyId_status_idx"       ON "Lead"("companyId", status);
CREATE INDEX "Lead_companyId_assignedToId_idx" ON "Lead"("companyId", "assignedToId");

-- LeadActivity: Historial de actividades por lead
CREATE TABLE "LeadActivity" (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type          "ActivityType" NOT NULL,
    notes         TEXT,
    "leadId"      TEXT NOT NULL REFERENCES "Lead"(id) ON DELETE CASCADE,
    "createdById" TEXT NOT NULL REFERENCES "User"(id),
    "companyId"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LeadActivity_leadId_idx"    ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_companyId_idx" ON "LeadActivity"("companyId");

-- Task: Tareas asignadas a vendedores por lead
CREATE TABLE "Task" (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title         TEXT NOT NULL,
    description   TEXT,
    "dueDate"     TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "leadId"      TEXT NOT NULL REFERENCES "Lead"(id) ON DELETE CASCADE,
    "assignedToId" TEXT NOT NULL REFERENCES "User"(id),
    "companyId"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Task_leadId_idx"                   ON "Task"("leadId");
CREATE INDEX "Task_companyId_idx"                ON "Task"("companyId");
CREATE INDEX "Task_assignedToId_isCompleted_idx" ON "Task"("assignedToId", "isCompleted");

-- Deal: Operación de compra/venta
CREATE TABLE "Deal" (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    status              "DealStatus" NOT NULL DEFAULT 'NEGOTIATION',
    -- Precio final
    "finalPrice"        DECIMAL(12,2) NOT NULL,
    "finalPriceCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "exchangeRate"      DECIMAL(10,4),
    -- Seña
    "depositAmount"     DECIMAL(12,2),
    "depositDate"       TIMESTAMP(3),
    "depositMethod"     "PaymentMethod",
    -- Comisión
    "commissionType"    "CommissionType" NOT NULL DEFAULT 'PERCENTAGE',
    "commissionValue"   DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    "closedAt"          TIMESTAMP(3),
    -- Multi-tenant y relaciones
    "companyId"         TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "leadId"            TEXT NOT NULL REFERENCES "Lead"(id) ON DELETE CASCADE,
    "unitId"            TEXT NOT NULL REFERENCES "Unit"(id) ON DELETE CASCADE,
    "sellerId"          TEXT NOT NULL REFERENCES "User"(id),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Deal_companyId_idx"        ON "Deal"("companyId");
CREATE INDEX "Deal_companyId_status_idx" ON "Deal"("companyId", status);
CREATE INDEX "Deal_sellerId_idx"         ON "Deal"("sellerId");

-- DealPayment: Pagos recibidos asociados al deal
CREATE TABLE "DealPayment" (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    amount       DECIMAL(12,2) NOT NULL,
    currency     "Currency" NOT NULL DEFAULT 'ARS',
    method       "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT,
    "dealId"     TEXT NOT NULL REFERENCES "Deal"(id) ON DELETE CASCADE,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DealPayment_dealId_idx" ON "DealPayment"("dealId");

-- DealCostItem: Gastos de cierre del deal
CREATE TABLE "DealCostItem" (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    concept      TEXT NOT NULL,
    "amountArs"  DECIMAL(12,2),
    "amountUsd"  DECIMAL(12,2),
    "dealId"     TEXT NOT NULL REFERENCES "Deal"(id) ON DELETE CASCADE
);
CREATE INDEX "DealCostItem_dealId_idx" ON "DealCostItem"("dealId");

-- TradeIn: Permuta entregada por el cliente en un deal
CREATE TABLE "TradeIn" (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    description         TEXT NOT NULL,
    "expectedValue"     DECIMAL(12,2) NOT NULL,
    "offeredValue"      DECIMAL(12,2) NOT NULL,
    "finalValue"        DECIMAL(12,2) NOT NULL,
    "convertedToUnitId" TEXT UNIQUE,
    "isConverted"       BOOLEAN NOT NULL DEFAULT false,
    "convertedAt"       TIMESTAMP(3),
    "dealId"            TEXT NOT NULL UNIQUE REFERENCES "Deal"(id) ON DELETE CASCADE
);

-- WhatsAppTemplate: Plantillas de mensajes de WhatsApp por empresa
CREATE TABLE "WhatsAppTemplate" (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        TEXT NOT NULL,
    template    TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("companyId", name)
);
CREATE INDEX "WhatsAppTemplate_companyId_idx" ON "WhatsAppTemplate"("companyId");

-- PublicClickEvent: Tracking del catálogo público
CREATE TABLE "PublicClickEvent" (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type        "ClickType" NOT NULL,
    "unitId"    TEXT,
    metadata    TEXT, -- JSON string
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PublicClickEvent_companyId_idx"      ON "PublicClickEvent"("companyId");
CREATE INDEX "PublicClickEvent_companyId_type_idx" ON "PublicClickEvent"("companyId", type);

-- ==================== DATOS DE DEMOSTRACIÓN ====================

INSERT INTO "Company" (id, name, slug, email, phone, "whatsappCentral", address, city, "currencyPreference", "isActive", "createdAt", "updatedAt")
VALUES (
    'demo-company-id',
    'Concesionaria Demo',
    'demo',
    'demo@concesionaria.com',
    '+54 9 11 1234-5678',
    '+5491112345678',
    'Av. Corrientes 1234',
    'Buenos Aires',
    'BOTH',
    true,
    NOW(),
    NOW()
);

-- NOTE: La password es 'admin123' hasheada con bcrypt. Correr db:seed para generar el hash correcto.
INSERT INTO "User" (id, email, name, password, role, "companyId", "isActive", "createdAt", "updatedAt")
VALUES (
    'demo-admin-id',
    'admin@demo.com',
    'Administrador Demo',
    '$2b$10$PLACEHOLDER_RUN_SEED', -- Placeholder: usar npm run db:seed
    'ADMIN',
    'demo-company-id',
    true,
    NOW(),
    NOW()
);
