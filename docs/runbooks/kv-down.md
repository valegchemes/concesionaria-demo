# Runbook: KV/Redis Down (Rate Limiting Degraded)

## 🚨 Alerta
- **Trigger**: `rate_limit_strict_blocked_total > 0` (métrica en Sentry/DataDog)
- **Síntoma**: Rate limiting en endpoints críticos (auth, billing, webhooks) retorna 429 o falla abierto
- **Severidad**: CRÍTICA - Afecta login, pagos, webhooks

---

## 🔍 Diagnóstico Rápido (≤ 2 min)

```bash
# 1. Verificar estado Upstash/Vercel KV
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  $UPSTASH_REDIS_REST_URL/ping

# 2. Verificar logs de la aplicación (Sentry)
# Filtrar por: "KV DOWN - BLOQUEANDO REQUEST CRÍTICO"

# 3. Verificar métricas de latencia KV
# p99 > 2000ms = timeout del wrapper withKVTimeout
```

**Causas comunes:**
- Upstash maintenance / outage
- Network partition entre Vercel y Upstash
- Rate limit excedido en plan Upstash (max commands/sec)
- Credenciales rotadas sin actualizar env vars

---

## ⚡ Mitigación Inmediata (≤ 5 min)

### Opción A: Failover a réplica read-only (si configurado)
```bash
# En Vercel Dashboard → Settings → Environment Variables
# Cambiar UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN a réplica
# Redeploy automático (Vercel) o `vercel --prod`
```

### Opción B: Deshabilitar rate limiting estricto temporalmente (último recurso)
```bash
# En Vercel Dashboard → Environment Variables
# Agregar: RATE_LIMIT_STRICT_DISABLED=true
# Redeploy
# ⚠️ SOLO para auth/pagos - expone a brute force
```

### Opción C: Escalar a plan Upstash superior
- Upstash Console → Database → Upgrade plan
- Propagación: ~1 min

---

## ✅ Verificación Post-Mitigación

```bash
# 1. Test login endpoint
curl -X POST https://app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Debe retornar 401 (no 429 ni 500)

# 2. Test rate limit headers
curl -I https://app.com/api/auth/login
# Verificar: X-RateLimit-Limit, X-RateLimit-Remaining presentes

# 3. Monitorear métricas 5 min
# rate_limit_strict_blocked_total = 0
```

---

## 📋 Post-Incidente (≤ 24h)

1. **Root Cause Analysis**: Revisar logs Upstash + Vercel
2. **Action Items**:
   - [ ] Configurar réplica read-only automática
   - [ ] Alerting proactivo: KV latency p99 > 1s
   - [ ] Documentar procedimiento de failover
   - [ ] Test de caos mensual (simular KV down)

---

## 📞 Contactos

| Rol | Contacto | Escalación |
|-----|----------|------------|
| On-call DevOps | @devops-oncall | Inmediato |
| Tech Lead | @tech-lead | 15 min |
| Upstash Support | support@upstash.com | Si outage > 10 min |

---

## 🔗 Referencias

- [Upstash Status Page](https://status.upstash.com)
- [Vercel KV Docs](https://vercel.com/docs/storage/vercel-kv)
- Código: `lib/rate-limit-kv.ts` (función `withKVTimeout`, `checkStrictRateLimit`)