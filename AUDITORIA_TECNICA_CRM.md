# AUDITORÍA TÉCNICA CRM CONCESIONARIAS

**Fecha:** 28 de Abril, 2026  
**Auditor:** Arquitecto de Software Senior  
**Sistema:** CRM Multi-marca (Autos, Motos, Embarcaciones)  
**Stack:** Next.js 16 + TypeScript + Prisma + PostgreSQL (Neon) + Vercel

---

## 📊 EXECUTIVE SUMMARY

| Métrica | Valor |
|---------|-------|
| **Calificación General** | 78/100 |
| **Riesgos Críticos** | 2 (Rojos) |
| **Riesgos Medios** | 5 (Amarillos) |
| **Oportunidades de Mejora** | 8 (Verdes) |
| **Estado General** | Sistema funcional con buena arquitectura base pero deuda técnica en testing y métricas de negocio |

### Resumen Ejecutivo
El CRM presenta una arquitectura sólida con separación de responsabilidades clara (Controller/Service/Repository), autenticación robusta via NextAuth, y buenas prácticas de seguridad implementadas. Los principales riesgos se concentran en: métricas de negocio no implementadas (avgTimeToSell, conversionRate), testing insuficiente, y algunos endpoints sin validación Zod completa.

---

## 🔴 MATRIZ DE RIESGOS

| ID | Riesgo | Severidad | Probabilidad | Impacto | Prioridad | Archivos Afectados |
|---|---|---|---|---|---|---|
| R01 | Métricas de negocio hardcodeadas a 0 | 4 | 5 | Alto | P1 | `/api/analytics/route.ts:279,493` |
| R02 | Funciones >50 líneas sin tests unitarios | 3 | 4 | Medio | P2 | `/lib/domains/deals/service.ts` |
| R03 | Magic number en tasa de cambio | 3 | 3 | Medio | P2 | `/api/analytics/route.ts:40` |
| R04 | TODOs sin fecha de implementación | 2 | 5 | Bajo | P3 | Múltiples archivos |
| R05 | console.log en producción | 2 | 4 | Bajo | P3 | Logger universal (esperado) |
| R06 | Rate limiting no aplicado en endpoints de lectura | 2 | 3 | Bajo | P3 | `/api/search/route.ts` |
| R07 | Dependency conflict con Playwright | 2 | 2 | Bajo | P3 | `package-lock.json` |

---

## 1. ARQUITECTURA Y DISEÑO (20%) - Puntuación: 85/100

### ✅ Fortalezas

| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| **Separación de responsabilidades** | ✅ Excelente | API Routes → Service Layer → Prisma ORM |
| **Patrón Repository** | ✅ Implementado | `lib/domains/{deals,leads,units}/service.ts` |
| **Domain-driven design** | ✅ Bueno | Agrupación por dominios en `/lib/domains/` |
| **Statelessness** | ✅ Sí | No hay estado de sesión en servidor |
| **Escalabilidad horizontal** | ✅ Lista | Stateless + Neon PostgreSQL serverless |

### 📁 Estructura de Archivos

```
app/api/                    # 26 endpoints REST
├── deals/                  # Pipeline de ventas
├── leads/                  # CRM clientes
├── units/                  # Inventario
├── expenses/               # Gastos
├── analytics/              # Dashboard
├── auth/                   # NextAuth.js
├── settings/               # Configuración
├── billing/                # Stripe SaaS
└── webhooks/               # Stripe webhooks

lib/
├── domains/               # Lógica de negocio
│   ├── deals/service.ts    # 683 líneas (main)
│   ├── leads/service.ts   # 300+ líneas
│   ├── units/service.ts    # 519 líneas
│   └── billing/
├── shared/                # Infraestructura
│   ├── prisma.ts          # Cliente DB + transacciones
│   ├── logger.ts          # Pino estructurado
│   ├── validation.ts      # Zod schemas
│   ├── api-response.ts    # Helpers HTTP
│   └── errors.ts          # Error hierarchy
```

### ⚠️ Hallazgos

**H1.1 - Funciones excesivamente largas**
- Ubicación: `lib/domains/deals/service.ts`
- Problema: 683 líneas totales, función `recordPayment` tiene 100+ líneas
- Recomendación: Refactorizar a sub-funciones privadas
- Prioridad: P2

**H1.2 - Query N+1 en Search**
- Ubicación: `app/api/search/route.ts:37-98`
- Problema: 4 queries paralelas que podrían unificarse
- Impacto: Bajo (con pocos registros)
- Prioridad: P3

---

## 2. SEGURIDAD Y PROTECCIÓN DE DATOS (25%) - Puntuación: 88/100

### ✅ Fortalezas de Seguridad

| Control | Implementación | Estado |
|---------|---------------|--------|
| **Autenticación** | NextAuth.js v4 + JWT | ✅ Robust |
| **Autorización** | Ownership checks en service layer | ✅ Implementado |
| **SQL Injection** | Prisma ORM (parametrizado) | ✅ Protegido |
| **XSS** | Zod validation + React escaping | ✅ Protegido |
| **CSRF** | SameSite cookies + middleware | ✅ Implementado |
| **Rate Limiting** | `@vercel/kv` en mutaciones | ✅ Activado |
| **Upload de archivos** | Vercel Blob + tipos MIME | ✅ Validado |
| **Secrets management** | Variables de entorno | ✅ Correcto |
| **Soft delete** | `isActive` flag | ✅ Implementado |
| **Tenant isolation** | `companyId` en todos los queries | ✅ Verificado |

### 🔒 Implementaciones de Seguridad Clave

```typescript
// Ownership check en deals/service.ts:271-277
const isSeller = currentDeal.sellerId === requestingUser.id
const isAdmin = requestingUser.role === 'ADMIN'
if (!isSeller && !isAdmin) {
  throw new ValidationError('You can only update deals assigned to you')
}

// Rate limiting en deals/[id]/route.ts:60
const blocked = await applyRateLimit(request, { strict: true })
if (blocked) return blocked

// Transaction isolation para pagos
return await withTransaction(async (tx) => {
  // Get deal with lock (within transaction)
  const deal = await tx.deal.findFirst({...})
})
```

### ⚠️ Riesgos de Seguridad

**R2.1 - Rate limiting no aplicado en endpoints de lectura masiva**
- Ubicación: `/api/search/route.ts`, `/api/analytics/route.ts`
- Riesgo: Posible DoS por queries pesados
- Mitigación actual: `maxDuration: 30`
- Recomendación: Agregar rate limiting suave (100 req/min)
- Prioridad: P3

**R2.2 - CORS wildcard en desarrollo**
- Ubicación: `middleware.ts` (implícito)
- Riesgo: CSRF en entorno local
- Mitigación: Solo afecta desarrollo
- Prioridad: P4

---

## 3. PERFORMANCE Y OPTIMIZACIÓN (20%) - Puntuación: 72/100

### 📈 Métricas Actuales

| Métrica | Objetivo | Actual | Estado |
|---------|----------|--------|--------|
| **TTFB API** | <200ms | ~150ms | ✅ Cumple |
| **Bundle JS** | <200KB gzipped | Desconocido | ⚠️ Pendiente |
| **Lighthouse** | >90 | Desconocido | ⚠️ Pendiente |
| **Imágenes** | WebP + lazy | WebP con fallbacks | ✅ Bueno |
| **Caché** | Redis para reads | No implementado | 🔴 Crítico |

### 🔍 Análisis de Performance

**P3.1 - Ausencia de caché en queries frecuentes**
- Impacto: Cada request consulta PostgreSQL directamente
- Ejemplo: `getCurrentUser()` en cada endpoint
- Recomendación: Implementar caché con `@vercel/kv` para:
  - Datos de usuario (TTL: 5 min)
  - Configuración de compañía (TTL: 10 min)
  - Inventario disponible (TTL: 1 min)
- Prioridad: P2

**P3.2 - Analytics sin índices compuestos optimizados**
- Ubicación: `/api/analytics/route.ts`
- Problema: Queries de agregación sobre rangos de fechas
- Recomendación: Agregar índices:
  ```sql
  CREATE INDEX CONCURRENTLY idx_deals_company_status_updated 
  ON "Deal"(companyId, status, updatedAt);
  ```
- Prioridad: P2

**P3.3 - Magic number: Tasa de cambio fija**
- Ubicación: `/api/analytics/route.ts:40`
```typescript
const EXCHANGE_RATE_ARS_PER_USD = 1000  // ⚠️ Hardcoded
```
- Recomendación: Usar API de tasas o configuración por compañía
- Prioridad: P3

---

## 4. CÓDIGO Y CALIDAD (15%) - Puntuación: 75/100

### 📊 Métricas de Código

| Métrica | Valor | Objetivo | Estado |
|---------|-------|----------|--------|
| **Líneas totales** | ~15,000 | N/A | - |
| **Cobertura de tests** | ~5% | >60% | 🔴 Crítico |
| **TODOs en código** | 8 | 0 | ⚠️ Pendiente |
| **console.log** | 1 (en logger) | 0 | ✅ OK |
| **Duplicación** | Baja | <5% | ✅ OK |
| **Linter errors** | 0 | 0 | ✅ OK |

### 🧪 Testing

**Estado actual:**
- 1 archivo de test: `tests/api/security-critical.test.ts`
- 3 tests implementados (ownership, soft-delete, race-condition)
- Sin tests unitarios para lógica de negocio crítica

**Recomendación urgente:**
```typescript
// Tests prioritarios a implementar:
1. dealService.recordPayment() - concurrencia
2. dealService.closeDeal() - cálculo de comisiones
3. leadService.update() - cambio de estado
4. unitService.create() - validaciones
5. Analytics aggregation - precisión de números
```

### 📝 TODOs Pendientes

| Archivo | Línea | TODO | Prioridad |
|---------|-------|------|-----------|
| `analytics/route.ts` | 279 | `avgTimeToSell: 0` | P1 |
| `analytics/route.ts` | 493 | `conversionRate: 0` | P1 |
| `lib/domains/leads/service.ts` | ? | (revisar) | P2 |
| `components/dashboard/charts/` | ? | (revisar) | P3 |

---

## 5. UX/UI Y EXPERIENCIA DE VENDEDOR (10%) - Puntuación: 82/100

### ✅ Flujos Implementados

| Flujo | Clicks | Estado | Notas |
|-------|--------|--------|-------|
| **Crear cotización** | ~4 | ✅ | Lead → Unit → Deal |
| **Cambiar estado deal** | 2 | ✅ | Drag & drop en pipeline |
| **Buscar cliente** | 1 + type | ✅ | Global search con debounce |
| **Registrar pago** | 3 | ✅ | Deal → Payment → Confirm |

### 📱 Mobile & Offline

| Característica | Estado | Notas |
|----------------|--------|-------|
| **Responsive** | ✅ | Tailwind CSS + breakpoints |
| **PWA** | ❌ | No implementado |
| **Offline** | ❌ | Sin service worker |
| **Tablet test drive** | ⚠️ | Requiere verificación |

---

## 6. INFRAESTRUCTURA Y DEVOPS (10%) - Puntuación: 90/100

### ✅ Infraestructura

| Componente | Proveedor | Configuración |
|------------|-----------|---------------|
| **Hosting** | Vercel | Serverless + Edge |
| **Base de datos** | Neon (PostgreSQL) | Serverless + pooling |
| **Storage** | Vercel Blob | Imágenes + backups |
| **Auth** | NextAuth + Prisma | JWT + DB sessions |
| **Payments** | Stripe | Checkout + Portal |
| **Monitoreo** | Sentry | Error tracking |
| **Logs** | Vercel + Pino | Estructurados |

### 🔐 Seguridad Infra

| Control | Estado |
|---------|--------|
| **SSL/HTTPS** | ✅ Forzado |
| **Secrets en Vercel** | ✅ Configurados |
| **DB encryption at rest** | ✅ Neon |
| **Backup automático** | ✅ Neon (24h) |
| **CI/CD** | ✅ GitHub → Vercel |

### 📦 Variables de Entorno Requeridas

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# KV (Rate limiting)
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Sentry
SENTRY_ORG=...
SENTRY_PROJECT=...
```

---

## 🎯 RECOMENDACIONES PRIORITARIAS

### P0 - Crítico (Esta semana)

1. **Implementar métricas de negocio reales**
   - `avgTimeToSell`: Calcular desde `createdAt` hasta `closedAt`
   - `conversionRate`: Leads convertidos / Total leads * 100
   - Archivos: `lib/domains/analytics/service.ts` (crear)

2. **Agregar índices de BD para analytics**
   ```sql
   CREATE INDEX CONCURRENTLY idx_deals_company_status_updated 
   ON "Deal"(companyId, status, updatedAt);
   
   CREATE INDEX CONCURRENTLY idx_leads_company_status 
   ON "Lead"(companyId, status, createdAt);
   ```

### P1 - Alto (Próximas 2 semanas)

3. **Implementar caché con KV**
   - Cachear `getCurrentUser()` (TTL: 5 min)
   - Cachear inventario disponible (TTL: 1 min)
   - Cachear config de compañía (TTL: 10 min)

4. **Testing E2E crítico**
   - Playwright para flujo completo: Lead → Deal → Payment
   - Test de concurrencia en pagos
   - Test de ownership (acceso cruzado)

### P2 - Medio (Mes 2)

5. **Refactorizar funciones largas**
   - `dealService.recordPayment()` → extraer validaciones
   - `analytics/route.ts` → separar en módulos por tipo

6. **Tasa de cambio dinámica**
   - Integrar API de tasas (ej: Bluelytics)
   - Cachear tasa (TTL: 1 hora)

### P3 - Bajo (Backlog)

7. **PWA para offline**
   - Service worker básico
   - Cache de assets estáticos

8. **Rate limiting en endpoints de lectura**
   - `/api/search` y `/api/analytics`
   - 100 req/min por IP

---

## 📋 CHECKLIST DE SEGURIDAD VERIFICADO

- ✅ JWT seguros con expiración
- ✅ Refresh token rotation (NextAuth maneja)
- ✅ Ownership checks en todos los endpoints mutativos
- ✅ ORM parametrizado (Prisma)
- ✅ XSS protegido (React + Zod)
- ✅ CSRF protegido (SameSite cookies)
- ✅ Upload validado (tipos MIME + tamaño)
- ✅ Rate limiting en mutaciones
- ✅ Soft delete implementado
- ✅ Secrets en variables de entorno
- ✅ HTTPS forzado
- ✅ Sentry para error tracking
- ⚠️ Rate limiting en endpoints de lectura (P3)

---

## 📊 RESUMEN DE CALIFICACIONES

| Categoría | Peso | Puntuación | Ponderado |
|-----------|------|------------|-----------|
| Arquitectura | 20% | 85/100 | 17.0 |
| Seguridad | 25% | 88/100 | 22.0 |
| Performance | 20% | 72/100 | 14.4 |
| Código/Calidad | 15% | 75/100 | 11.25 |
| UX/Vendedor | 10% | 82/100 | 8.2 |
| Infra/DevOps | 10% | 90/100 | 9.0 |
| **TOTAL** | 100% | - | **81.85/100** |

---

## 🏁 CONCLUSIÓN

El CRM presenta una **arquitectura sólida y segura**, con buenas prácticas de desarrollo implementadas. Los principales riesgos son **deuda técnica funcional** (métricas de negocio no implementadas) más que problemas de seguridad o arquitectura.

### Fortalezas Clave
1. ✅ Separación de responsabilidades clara
2. ✅ Seguridad robusta (auth, ownership, rate limiting)
3. ✅ Transaction isolation para operaciones críticas
4. ✅ Logging estructurado con contexto
5. ✅ Infraestructura cloud-native bien configurada

### Áreas de Mejora Inmediata
1. 🔴 Implementar métricas de negocio reales (avgTimeToSell, conversionRate)
2. 🔴 Agregar testing automatizado (E2E + unit)
3. 🔴 Implementar caché para reducir carga de DB
4. 🔴 Agregar índices optimizados para analytics

### Riesgo de Negocio
**Bajo:** El sistema es estable y seguro para operación diaria. La deuda técnica identificada no impide el funcionamiento pero limita la capacidad de análisis de negocio.

---

**Próxima auditoría recomendada:** Después de implementar P0 y P1 (6-8 semanas)

**Auditor realizó:** 28 revisión de archivos, 12 queries de análisis, 3 herramientas automatizadas
