# Runbook: Database Connection Failure

## 🚨 Alerta
- **Trigger**: `checkDatabaseConnection() = false` (health check falla)
- **Síntoma**: APIs retornan 500, Prisma errors `P1001`/`P1008`, timeouts
- **Severidad**: CRÍTICA - Sistema completamente inoperativo

---

## 🔍 Diagnóstico Rápido (≤ 2 min)

```bash
# 1. Health check endpoint
curl https://app.com/api/health
# Debe retornar: {"status":"ok","database":true}

# 2. Verificar conectividad directa (si tienes acceso)
psql "$DATABASE_URL" -c "SELECT 1;"

# 3. Verificar Supabase Dashboard
# https://supabase.com/dashboard/project/<ref> → Database → Logs
# Buscar: "too many connections", "out of memory", "disk full"

# 4. Vercel Dashboard → Functions → Logs
# Filtrar: "P1001", "P1008", "connection refused", "timeout"
```

**Causas comunes:**
- Supabase maintenance / outage
- Connection pool agotado (max 100 connections en pooler)
- Query runaway consumiendo recursos
- Migración Prisma fallida / lock en tabla
- Disk full en instancia DB
- Credenciales rotadas (password change sin actualizar env)

---

## ⚡ Mitigación Inmediata (≤ 5 min)

### 1. Verificar estado Supabase
- https://status.supabase.com
- Si hay incidente confirmado → esperar resolución + comunicar a usuarios

### 2. Reiniciar connection pool (si pooler agotado)
```bash
# En Supabase Dashboard → Database → Connection Pooling
# "Reset pool" o aumentar max connections temporalmente
# O desde Vercel: redeploy para forzar nuevas conexiones
vercel --prod --force
```

### 3. Matar queries runaway (si sospecha)
```sql
-- En Supabase SQL Editor o psql:
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '30 seconds';

-- Matar query específica:
SELECT pg_terminate_backend(pid);
```

### 4. Failover a read replica (si configurado)
```bash
# En Vercel env vars:
# DATABASE_URL → replica URL (read-only)
# DIRECT_URL → replica direct URL
# ⚠️ Solo lectura - mutaciones fallarán
vercel --prod
```

### 5. PITR Recovery (último recurso - pérdida datos minutos)
```bash
# Supabase Dashboard → Database → Backups → Point-in-time Recovery
# Seleccionar timestamp antes del incidente
# Nueva DB → actualizar DATABASE_URL en Vercel
# RTO: ~15 min, RPO: ~1 min
```

---

## ✅ Verificación Post-Mitigación

```bash
# 1. Health check
curl https://app.com/api/health
# {"status":"ok","database":true}

# 2. Test query crítica
curl https://app.com/api/leads?limit=1
# 200 OK con datos

# 3. Test mutación
curl -X POST https://app.com/api/leads \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"+5491112345678"}'
# 201 Created

# 4. Monitorear 10 min
# - Error rate < 0.1%
# - Latencia p95 < 500ms
# - Conexiones activas < 80% pool
```

---

## 📋 Post-Incidente (≤ 24h)

1. **Root Cause**: Análisis logs Supabase + Vercel + Application
2. **Action Items**:
   - [ ] Alerting proactivo: `checkDatabaseConnection()` cada 30s
   - [ ] Connection pool sizing: revisar max connections vs tráfico
   - [ ] Query performance: identificar slow queries (pg_stat_statements)
   - [ ] Read replica configurada y testeada
   - [ ] PITR drill mensual
   - [ ] Documentar procedimiento de failover

---

## 🔗 Código Relevante

- `lib/prisma.ts`: `checkDatabaseConnection()`, `withRetry()`, `withTransaction()`
- `app/api/health/route.ts`: Health check endpoint
- `prisma/schema.prisma`: Índices compuestos para performance
- Pool config: Supabase pooler puerto 6543 (serverless)

---

## 📞 Contactos

| Rol | Contacto | Escalación |
|-----|----------|------------|
| On-call DevOps | @devops-oncall | Inmediato |
| DBA / Supabase | Supabase Support | 10 min |
| Tech Lead | @tech-lead | 15 min |

---

## 🔗 Referencias

- [Supabase Status](https://status.supabase.com)
- [Supabase PITR Docs](https://supabase.com/docs/guides/platform/point-in-time-recovery)
- [Prisma Connection Pooling](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/connection-management-in-serverless-environments)