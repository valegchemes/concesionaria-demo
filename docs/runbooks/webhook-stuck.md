# Runbook: Webhook Event Stuck in "processing" State

## 🚨 Alerta
- **Trigger**: `WebhookEvent` con `status='processing'` y `receivedAt > now - 1h`
- **Síntoma**: Webhooks de Mercado Pago no se completan, pagos no se reflejan
- **Severidad**: ALTA - Afecta conciliación de pagos, suscripciones

---

## 🔍 Diagnóstico Rápido (≤ 3 min)

```bash
# 1. Consultar eventos trabados
# En DB (psql / Prisma Studio / Adminer):
SELECT * FROM "WebhookEvent" 
WHERE status = 'processing' 
  AND "receivedAt" < NOW() - INTERVAL '1 hour'
ORDER BY "receivedAt" ASC;

# 2. Verificar logs del webhook endpoint
# Sentry: filtrar por "MPWebhook" + "error"
# Buscar: timeout MP API, signature invalid, JSON parse error

# 3. Verificar estado de Mercado Pago
# Status page: https://status.mercadopago.com
# Credenciales válidas: MP_ACCESS_TOKEN vigente
```

**Causas comunes:**
- Crash del servidor después de guardar `processing` pero antes de `processed`
- Timeout consultando MP API (`getMPPayment().get()` > 10s)
- Firma HMAC inválida (replay attack o webhook mal formado)
- `MP_ACCESS_TOKEN` expirado/rotado
- Deadlock en DB al actualizar suscripción

---

## ⚡ Recuperación (≤ 10 min)

### Paso 1: Identificar eventos afectados
```sql
-- Obtener eventIds trabados
SELECT eventId, type, payload, "receivedAt" 
FROM "WebhookEvent" 
WHERE status = 'processing' 
  AND "receivedAt" < NOW() - INTERVAL '1 hour';
```

### Paso 2: Re-procesar manualmente (idempotente)

**Opción A: Via endpoint interno (recomendado)**
```bash
# Para cada eventId:
curl -X POST https://app.com/api/diag/reprocess-webhook \
  -H "Authorization: Bearer $DIAG_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": "mp_123456789", "force": true}'
```

**Opción B: Reset directo en DB + re-trigger webhook**
```sql
-- 1. Marcar como failed para permitir reintento
UPDATE "WebhookEvent" 
SET status = 'failed', 
    error = 'Manual recovery: stuck in processing > 1h',
    "processedAt" = NOW()
WHERE eventId = 'mp_123456789';

-- 2. Re-enviar webhook desde Mercado Pago Dashboard
# MP Dashboard → Your Integrations → Webhooks → Resend
# O usar MP API: POST /v1/webhooks/{id}/resend
```

### Paso 3: Verificar procesamiento
```bash
# Monitorear logs
# Sentry: "MP payment webhook processed" + eventId

# Verificar en DB
SELECT * FROM "WebhookEvent" WHERE eventId = 'mp_123456789';
-- Debe tener status = 'processed', processedAt = ahora

# Verificar suscripción actualizada
SELECT * FROM "SaasSubscription" WHERE companyId = '...';
-- status = 'ACTIVE', currentPeriodEnd = futuro
```

---

## ✅ Verificación Post-Recuperación

1. **Todos los eventos procesados**: `status='processing' AND receivedAt < now-1h` → 0 rows
2. **Suscripciones sincronizadas**: `SaasSubscription.status` coincide con MP
3. **Alertas limpias**: No nuevas alertas en 10 min

---

## 📋 Post-Incidente (≤ 24h)

1. **Root Cause**: ¿Por qué se trabó? (timeout MP, crash deploy, deadlock)
2. **Action Items**:
   - [ ] Aumentar timeout MP API si es recurrente (actual: 10s)
   - [ ] Implementar circuit breaker para MP API
   - [ ] Alerting proactivo: `WebhookEvent stuck > 30 min`
   - [ ] Idempotency key en `WebhookEvent.eventId` (ya existe)
   - [ ] Test de caos: matar proceso durante webhook

---

## 🔗 Código Relevante

- `app/api/webhooks/mercadopago/route.ts`: Lógica principal + idempotencia
- `lib/domains/billing/service.ts`: `syncSubscriptionFromPayment()`
- `prisma/schema.prisma`: Modelo `WebhookEvent` con índice `[status, receivedAt]`
- Umbral stale: `STALE_PROCESSING_THRESHOLD_MS = 60 * 60 * 1000` (1h)

---

## 📞 Contactos

| Rol | Contacto |
|-----|----------|
| On-call Billing | @billing-oncall |
| Tech Lead | @tech-lead |
| MP Support | Mercado Pago Developers Portal |

---

## 🔗 Referencias

- [MP Webhook Docs](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/your-integrations/webhooks)
- [MP Status](https://status.mercadopago.com)