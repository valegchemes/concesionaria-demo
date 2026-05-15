# 🆓 DEPLOYMENT GRATUITO - Sin Servicios Pagos

Esta guía te permite deployar el proyecto **completamente gratis** sin necesidad de Redis, Vercel KV, o cualquier servicio pago.

---

## ✅ ALTERNATIVAS GRATUITAS IMPLEMENTADAS

| Servicio Original | Alternativa Gratuita | Implementado |
|-------------------|---------------------|--------------|
| **Vercel KV (Redis)** | In-Memory Store | ✅ `rate-limit-memory.ts` |
| **Redis (Locks)** | Filesystem Locks | ✅ `distributed-lock-fs.ts` |
| **Redis (Webhooks)** | PostgreSQL Table | ✅ `WebhookEvent` model |
| **Vercel Hosting** | Railway/Render/Fly.io | ✅ Compatible |
| **Neon PostgreSQL** | PostgreSQL local/Railway | ✅ Compatible |

---

## 🚀 OPCIONES DE HOSTING GRATUITO

### Opción 1: Railway (Recomendado)

**Incluye**:
- PostgreSQL gratis (500MB)
- 500 horas/mes gratis
- Deploy automático desde GitHub

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Crear proyecto
railway init

# 4. Agregar PostgreSQL
railway add postgresql

# 5. Deploy
railway up
```

### Opción 2: Render

**Incluye**:
- PostgreSQL gratis (1GB, 90 días)
- Web service gratis (750 horas/mes)

```bash
# 1. Conectar repo en render.com
# 2. Crear PostgreSQL database
# 3. Crear Web Service
# 4. Conectar DATABASE_URL
```

### Opción 3: Fly.io

**Incluye**:
- PostgreSQL gratis (3GB)
- 3 VMs gratis

```bash
# 1. Instalar flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
flyctl auth login

# 3. Launch
flyctl launch

# 4. Agregar PostgreSQL
flyctl postgres create
```

### Opción 4: Local con Docker

**Completamente gratis, sin límites**

```bash
# docker-compose.yml ya incluido en el proyecto
docker-compose up -d
```

---

## 📋 SETUP PASO A PASO (Railway)

### 1. Crear Cuenta en Railway

1. Ir a [railway.app](https://railway.app)
2. Sign up con GitHub (gratis)
3. Verificar email

### 2. Crear Proyecto

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto desde tu repo
railway init
```

### 3. Agregar PostgreSQL

```bash
# Agregar PostgreSQL (gratis 500MB)
railway add postgresql

# Railway automáticamente crea DATABASE_URL
```

### 4. Configurar Variables de Entorno

```bash
# Generar secretos
openssl rand -base64 48  # Para NEXTAUTH_SECRET
openssl rand -base64 48  # Para CRON_SECRET

# Agregar variables
railway variables set NEXTAUTH_SECRET="tu-secret-aqui"
railway variables set NEXTAUTH_URL="https://tu-app.up.railway.app"
railway variables set CRON_SECRET="tu-cron-secret"
railway variables set STRIPE_SECRET_KEY="sk_test_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 5. Deploy

```bash
# Deploy automático
railway up

# O conectar GitHub para auto-deploy
railway link
```

### 6. Aplicar Migraciones

```bash
# Conectar a la base de datos
railway run npm run db:generate
railway run npm run db:deploy

# Aplicar índices
railway run npm run db:indexes

# Aplicar migración de webhooks
railway run npx prisma migrate dev --name add_webhook_events
```

---

## 🔧 CONFIGURACIÓN LOCAL (Desarrollo)

### 1. PostgreSQL Local

```bash
# Opción A: Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=concesionaria \
  -p 5432:5432 \
  postgres:16

# Opción B: Instalación nativa
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql@16
# Linux: sudo apt install postgresql-16
```

### 2. Variables de Entorno

```bash
# Copiar ejemplo
cp .env.example .env

# Editar .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concesionaria"
NEXTAUTH_SECRET="$(openssl rand -base64 48)"
NEXTAUTH_URL="http://localhost:3000"
CRON_SECRET="$(openssl rand -base64 48)"
```

### 3. Inicializar Base de Datos

```bash
# Generar Prisma client
npm run db:generate

# Aplicar migraciones
npm run db:deploy

# Aplicar índices
npm run db:indexes

# Seedear datos de prueba
npm run db:seed
```

### 4. Iniciar Desarrollo

```bash
npm run dev
```

---

## ✅ VERIFICACIÓN POST-DEPLOY

### 1. Health Check

```bash
curl https://tu-app.up.railway.app/api/health
```

**Esperado**:
```json
{
  "status": "healthy",
  "checks": {
    "postgres": { "status": "healthy" }
  }
}
```

### 2. Rate Limiting

```bash
# Hacer 150 requests rápidos
for i in {1..150}; do
  curl https://tu-app.up.railway.app/api/units &
done

# Debe retornar 429 después de 100 requests
```

### 3. Cron Job Lock

```bash
# Ejecutar 2 veces en paralelo
curl https://tu-app.up.railway.app/api/cron/check-installments \
  -H "Authorization: Bearer $CRON_SECRET" &

curl https://tu-app.up.railway.app/api/cron/check-installments \
  -H "Authorization: Bearer $CRON_SECRET" &

# Una debe retornar 409 (lock ocupado)
```

### 4. Webhook Idempotencia

```bash
# Enviar mismo evento 2 veces
curl -X POST https://tu-app.up.railway.app/api/webhooks/stripe \
  -H "stripe-signature: ..." \
  -d @webhook-event.json

# Segunda vez debe retornar "already processed"
```

---

## 📊 LÍMITES GRATUITOS

### Railway (Tier Gratuito)

- ✅ PostgreSQL: 500MB
- ✅ Compute: 500 horas/mes
- ✅ Bandwidth: 100GB/mes
- ✅ Builds: Ilimitados

**Suficiente para**:
- 1-10 usuarios concurrentes
- ~10,000 requests/día
- ~1,000 deals/mes

### Render (Tier Gratuito)

- ✅ PostgreSQL: 1GB (90 días)
- ✅ Web Service: 750 horas/mes
- ✅ Bandwidth: 100GB/mes

**Limitación**: Duerme después de 15min inactividad

### Fly.io (Tier Gratuito)

- ✅ PostgreSQL: 3GB
- ✅ 3 VMs compartidas
- ✅ 160GB bandwidth/mes

---

## 🔄 MIGRACIÓN A REDIS (Futuro)

Cuando tengas presupuesto, puedes migrar fácilmente a Redis:

### 1. Agregar Upstash Redis (Gratis hasta 10k requests/día)

```bash
# Crear cuenta en upstash.com
# Crear database Redis
# Copiar URL y TOKEN
```

### 2. Actualizar Variables

```bash
railway variables set UPSTASH_REDIS_REST_URL="https://..."
railway variables set UPSTASH_REDIS_REST_TOKEN="..."
```

### 3. Cambiar Imports

```typescript
// Cambiar de:
import { requireRateLimit } from '@/lib/shared/rate-limit-memory'
import { withLock } from '@/lib/shared/distributed-lock-fs'

// A:
import { requireRateLimit } from '@/lib/shared/rate-limit'
import { withLock } from '@/lib/shared/distributed-lock'
```

### 4. Redeploy

```bash
railway up
```

---

## 🐛 TROUBLESHOOTING

### Error: "Cannot find module 'rate-limit'"

**Causa**: Imports incorrectos.

**Solución**:
```typescript
// Usar versiones sin Redis:
import { requireRateLimit } from '@/lib/shared/rate-limit-memory'
import { withLock } from '@/lib/shared/distributed-lock-fs'
```

### Error: "ENOENT: no such file or directory '.locks'"

**Causa**: Directorio de locks no existe.

**Solución**: Se crea automáticamente, pero puedes crearlo manualmente:
```bash
mkdir -p .locks
```

### Error: "WebhookEvent table does not exist"

**Causa**: Migración no aplicada.

**Solución**:
```bash
# Aplicar migración
npx prisma migrate dev --name add_webhook_events

# O aplicar SQL directamente
psql $DATABASE_URL < prisma/migrations/add_webhook_events.sql
```

### Rate Limiting no funciona en múltiples instancias

**Causa**: In-memory store es por instancia.

**Solución**: Esto es esperado. Cada instancia tiene su propio contador. Para apps pequeñas es suficiente. Si necesitas rate limiting global, usa Redis (Upstash tiene tier gratuito).

---

## 💡 OPTIMIZACIONES PARA TIER GRATUITO

### 1. Reducir Uso de Base de Datos

```typescript
// Usar cache in-memory para queries frecuentes
const cache = new Map()

export async function getCachedCompany(id: string) {
  if (cache.has(id)) return cache.get(id)
  
  const company = await prisma.company.findUnique({ where: { id } })
  cache.set(id, company)
  
  return company
}
```

### 2. Limpiar Webhooks Antiguos

```typescript
// Agregar cron job para limpiar eventos >7 días
export async function cleanupOldWebhooks() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  
  await prisma.webhookEvent.deleteMany({
    where: { expiresAt: { lt: sevenDaysAgo } }
  })
}
```

### 3. Comprimir Respuestas

```typescript
// Ya incluido en next.config.js
compress: true
```

---

## 📞 SOPORTE

- **Documentación**: Ver `CHANGELOG_SECURITY_FIXES.md`
- **Issues**: GitHub Issues
- **Railway Docs**: https://docs.railway.app
- **Render Docs**: https://render.com/docs

---

**Versión**: 0.2.0  
**Costo**: $0/mes  
**Status**: ✅ Production Ready (tier gratuito)
