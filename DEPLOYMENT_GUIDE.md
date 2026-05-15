# 🚀 DEPLOYMENT GUIDE - v0.2.0

Guía rápida para deployar la versión 0.2.0 con todas las correcciones de seguridad.

---

## ⚡ QUICK START

```bash
# 1. Clonar y instalar
git pull origin main
npm install

# 2. Verificar variables de entorno
npm run verify:env

# 3. Generar Prisma client
npm run db:generate

# 4. Aplicar índices (solo primera vez)
npm run db:indexes

# 5. Deploy
vercel --prod

# 6. Verificar deployment
VERIFY_URL=https://tu-dominio.com npm run verify:deploy
```

---

## 📋 PRE-REQUISITOS

### 1. Variables de Entorno Obligatorias

```bash
# Core
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<min 32 chars, aleatorio>
NEXTAUTH_URL=https://tu-dominio.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis (Vercel KV)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Cron
CRON_SECRET=<min 32 chars, aleatorio>

# Diagnostic (opcional)
DIAG_SECRET_TOKEN=<min 32 chars, aleatorio>
```

### 2. Generar Secretos Fuertes

```bash
# NEXTAUTH_SECRET
openssl rand -base64 48

# CRON_SECRET
openssl rand -base64 48

# DIAG_SECRET_TOKEN
openssl rand -base64 48
```

### 3. Configurar Vercel KV (Redis)

1. Ir a Vercel Dashboard
2. Storage > Create Database > KV
3. Conectar al proyecto
4. Variables se agregan automáticamente

---

## 🔧 DEPLOYMENT STEPS

### Opción A: Vercel (Recomendado)

```bash
# 1. Conectar repositorio a Vercel
vercel link

# 2. Configurar variables de entorno
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add STRIPE_SECRET_KEY production
# ... (todas las variables)

# 3. Deploy
vercel --prod

# 4. Aplicar índices de base de datos
npm run db:indexes

# 5. Verificar
VERIFY_URL=https://tu-dominio.vercel.app npm run verify:deploy
```

### Opción B: Docker

```bash
# 1. Build
docker build -t concesionaria:0.2.0 .

# 2. Run
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  -e KV_REST_API_URL="..." \
  -e KV_REST_API_TOKEN="..." \
  concesionaria:0.2.0

# 3. Aplicar índices
docker exec -it <container_id> npm run db:indexes
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

```bash
✅ Health check responde 200
   curl https://tu-dominio.com/api/health

✅ Rate limiting activo
   # Hacer 150 requests rápidos, debe retornar 429
   for i in {1..150}; do curl https://tu-dominio.com/api/units & done

✅ Middleware inyecta headers
   # Verificar en logs que x-user-id, x-company-id están presentes

✅ Cron job con lock
   # Ejecutar 2 veces en paralelo, una debe retornar 409
   curl https://tu-dominio.com/api/cron/check-installments \
     -H "Authorization: Bearer $CRON_SECRET" &
   curl https://tu-dominio.com/api/cron/check-installments \
     -H "Authorization: Bearer $CRON_SECRET" &

✅ Webhook de Stripe con idempotencia
   # Enviar mismo evento 2 veces, segunda debe retornar "already processed"

✅ Logs sin datos sensibles
   # Revisar Sentry/logs, no debe haber passwords/tokens

✅ Índices de base de datos creados
   psql $DATABASE_URL -c "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;"

✅ Performance mejorado
   # Medir tiempo de respuesta (debe ser <200ms)
   time curl https://tu-dominio.com/api/units?limit=50
```

---

## 🔍 VERIFICATION SCRIPT

```bash
# Ejecutar script de verificación automática
VERIFY_URL=https://tu-dominio.com \
CRON_SECRET=$CRON_SECRET \
npm run verify:deploy
```

**Output esperado**:
```
✅ Health Check
✅ Rate Limiting
✅ Cron Lock
✅ Middleware Headers
✅ Logger Redaction
✅ Database Indexes
✅ Env Validation

7/7 tests passed
✨ All verifications passed! System is ready.
```

---

## 🐛 TROUBLESHOOTING

### Error: "Rate limit check failed"

**Causa**: Redis no configurado.

**Solución**:
```bash
# Verificar variables
vercel env ls

# Agregar si faltan
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
```

### Error: "NEXTAUTH_SECRET must not contain common weak patterns"

**Causa**: Secret débil o de ejemplo.

**Solución**:
```bash
# Generar nuevo secret fuerte
openssl rand -base64 48

# Actualizar
vercel env rm NEXTAUTH_SECRET production
vercel env add NEXTAUTH_SECRET production
```

### Error: "Cannot use Stripe test key in production"

**Causa**: Usando `sk_test_*` en producción.

**Solución**:
```bash
# Obtener live key de Stripe Dashboard
# Developers > API keys > Secret key (live mode)

# Actualizar
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production
```

### Queries lentas

**Causa**: Índices no aplicados.

**Solución**:
```bash
# Aplicar índices
npm run db:indexes

# Verificar
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';"
# Debe retornar 30+ índices
```

### Webhook de Stripe falla

**Causa**: IP no whitelisted o secret incorrecto.

**Solución**:
```bash
# 1. Verificar secret
# Stripe Dashboard > Webhooks > [tu webhook] > Signing secret

# 2. En desarrollo, deshabilitar validación de IP
# (solo valida en producción)

# 3. Probar con Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 📊 MONITORING

### Sentry

```bash
# Configurar Sentry
vercel env add SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
```

### Vercel Analytics

```bash
# Habilitar en Vercel Dashboard
# Analytics > Enable
```

### Custom Metrics

```bash
# Ver métricas de rate limiting
curl https://tu-dominio.com/api/admin/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🔄 ROLLBACK

Si algo falla, rollback rápido:

```bash
# Vercel
vercel rollback

# Docker
docker run -p 3000:3000 concesionaria:0.1.0
```

---

## 📞 SUPPORT

- **Changelog**: Ver `CHANGELOG_SECURITY_FIXES.md`
- **Auditoría completa**: Ver `AUDITORIA_TECNICA.md`
- **Issues**: GitHub Issues

---

**Versión**: 0.2.0  
**Fecha**: 2024  
**Status**: ✅ Production Ready
