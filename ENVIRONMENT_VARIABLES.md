# Variables de Entorno Requeridas - Guía de Configuración

Este documento lista **todas las variables de entorno** que deben configurarse en producción (Vercel / Docker / `.env.production`).

---

## 🔐 Críticas (Requeridas para arrancar)

| Variable | Descripción | Generar con | Ejemplo |
|----------|-------------|-------------|---------|
| `NEXTAUTH_SECRET` | Firma JWT sessions NextAuth | `openssl rand -base64 32` | `a1b2c3d4e5f6...` (32+ chars) |
| `DATABASE_URL` | PostgreSQL connection string (pooler puerto 6543) | Supabase/Neon Dashboard | `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | PostgreSQL direct connection (migraciones) | Supabase/Neon Dashboard | `postgresql://user:pass@host:5432/db` |

---

## 🔑 Autenticación y OAuth

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `NEXTAUTH_URL` | URL canónica de la app | - | ✅ Sí |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Google Cloud Console | Para Email AI |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Google Cloud Console | Para Email AI |

---

## 💳 Pagos y Suscripciones

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `MP_ACCESS_TOKEN` | Mercado Pago Access Token | MP Developers Panel | ✅ Sí |
| `MP_PUBLIC_KEY` | Mercado Pago Public Key | MP Developers Panel | ✅ Sí |
| `MP_WEBHOOK_SECRET` | MP Webhook Signature Secret | MP Developers Panel | ✅ Sí |
| `CRON_SECRET` | Secret para endpoints cron (Vercel) | `openssl rand -base64 32` | ✅ Sí |

---

## 📦 Storage y Assets

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Token | Vercel Dashboard → Blob | ✅ Sí |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard | Para catálogo público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Supabase Dashboard | Para catálogo público |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard | Para catálogo público |

---

## 🤖 IA y Email

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `GEMINI_API_KEY` | Google Gemini API Key | Google AI Studio | Para Email AI |

---

## 🔐 Seguridad Adicional (Nuevas - Sprint 1-2)

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `DOC_ACCESS_SECRET` | JWT secret para tokens de descarga documentos (15 min TTL) | `openssl rand -base64 32` | ✅ **Nueva - Sprint 1** |
| `GMAIL_ENCRYPTION_KEY` | Clave AES-256-GCM para cifrar tokens Gmail en BD (32 bytes base64) | `openssl rand -base64 32` | ✅ **Nueva - Sprint 2** |
| `DIAG_SECRET_TOKEN` | Token para endpoints diagnósticos internos | `openssl rand -base64 32` | ✅ Sí |

---

## 📡 Tiempo Real y Monitoreo

| Variable | Descripción | Generar con | Requerida |
|----------|-------------|-------------|-----------|
| `PUSHER_APP_ID` | Pusher App ID | Pusher Dashboard | Para realtime |
| `PUSHER_KEY` | Pusher Key | Pusher Dashboard | Para realtime |
| `PUSHER_SECRET` | Pusher Secret | Pusher Dashboard | Para realtime |
| `PUSHER_CLUSTER` | Pusher Cluster (ej: `mt1`) | Pusher Dashboard | Para realtime |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher Key (cliente) | Pusher Dashboard | Para realtime |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher Cluster (cliente) | Pusher Dashboard | Para realtime |
| `SENTRY_DSN` | Sentry DSN (server) | Sentry Dashboard | ✅ Sí |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (cliente) | Sentry Dashboard | ✅ Sí |
| `SENTRY_ORG` | Sentry Organization | Sentry Dashboard | ✅ Sí |
| `SENTRY_PROJECT` | Sentry Project | Sentry Dashboard | ✅ Sí |

---

## ⚙️ Configuración General

| Variable | Descripción | Default | Requerida |
|----------|-------------|---------|-----------|
| `PUBLIC_URL` | URL pública de la app (para emails, webhooks) | `NEXTAUTH_URL` | ✅ Sí |
| `DEFAULT_EXCHANGE_RATE_ARS_PER_USD` | Tipo de cambio ARS/USD por defecto | `1000` | No |
| `NODE_ENV` | Entorno: `development` \| `production` \| `test` | `development` | ✅ Sí |

---

## 🐳 Docker / Local Development

### `.env.production` (para Docker Compose)
```bash
# Copiar este archivo y completar valores reales
# NUNCA commitear este archivo (está en .gitignore)

DATABASE_URL=postgresql://postgres:secure_password@db:5432/concesionaria?schema=public
DIRECT_URL=postgresql://postgres:secure_password@db:5432/concesionaria?schema=public
NEXTAUTH_SECRET=tu-secret-generado-con-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
# ... resto de variables
```

### `.env.example` (committido - plantilla)
Ver archivo `.env.example` en raíz del repo.

---

## 🔄 Rotación de Secretos (Runbook)

| Secreto | Frecuencia | Procedimiento |
|---------|------------|---------------|
| `NEXTAUTH_SECRET` | 90 días | 1. Generar nuevo 2. Actualizar Vercel 3. Redeploy (invalida sesiones) |
| `DOC_ACCESS_SECRET` | 90 días | 1. Generar nuevo 2. Actualizar Vercel 3. Redeploy (tokens existentes expiran en 15 min) |
| `GMAIL_ENCRYPTION_KEY` | Anual | 1. Generar nuevo 2. Ejecutar script migración re-cifrado 3. Actualizar Vercel 4. Redeploy |
| `MP_WEBHOOK_SECRET` | Según MP | 1. Rotar en MP Dashboard 2. Actualizar Vercel 3. Redeploy |
| `CRON_SECRET` | 90 días | 1. Generar nuevo 2. Actualizar Vercel 3. Redeploy |

---

## ✅ Checklist Pre-Deploy

```bash
# 1. Verificar todas las variables críticas en Vercel Dashboard
vercel env ls

# 2. Test build local
npm run build

# 3. Typecheck
npx tsc --noEmit

# 4. Tests
npm run test

# 5. Security audit
npm audit --production

# 6. Deploy a staging (develop branch)
git push origin develop

# 7. Validar en staging
# - Login/logout
# - Crear lead/unidad/operación
# - Subir imagen
# - Generar documento → descargar PDF vía WhatsApp
# - Conectar Gmail → Email AI
# - Webhook MP (sandbox)

# 8. Deploy a producción (main branch)
git push origin main
```

---

## 🚨 Variables NO Committiar Nunca

- `.env.production`
- `.env.local`
- `.env.*.local`
- Cualquier archivo con secrets reales

**Solo committiar:** `.env.example`, `.env.test` (si aplica)

---

## 📞 Soporte

| Problema | Contacto |
|----------|----------|
| Variables Vercel | Vercel Support |
| Supabase DB | Supabase Support |
| Mercado Pago | MP Developers Support |
| Google OAuth | Google Cloud Support |
| Sentry | Sentry Support |