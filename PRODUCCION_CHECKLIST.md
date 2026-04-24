# Checklist para Despliegue a Producción

**Estado:** ✅ **LISTO PARA PRODUCCIÓN**  
**Build:** Exitoso (37 rutas generadas)  
**Fecha:** 23 de Abril, 2026

---

## ✅ Completado

### 1. Correcciones de Código
- [x] Inconsistencias Schema/Tipos corregidas (deals, units)
- [x] Prisma Client consolidado
- [x] NextAuth configurado correctamente
- [x] Manejo de errores null para Supabase
- [x] Build pasa sin errores de TypeScript

### 2. Configuración de Sentry
- [x] `sentry.client.config.ts` creado
- [x] `sentry.server.config.ts` creado
- [x] `sentry.edge.config.ts` creado
- [x] `next.config.js` actualizado con `withSentryConfig`
- [x] Turbopack configurado para compatibilidad

### 3. Rate Limiting
- [x] `lib/shared/rate-limit-wrapper.ts` creado
- [x] Wrapper `withRateLimit` implementado
- [x] Wrapper `withAuthRateLimit` para auth
- [x] Wrapper `withPublicRateLimit` para catálogo público

### 4. Health Check & Monitoreo
- [x] `/api/health` endpoint creado
- [x] Script `scripts/staging-check.js` para verificación

### 5. Migraciones
- [x] Base de datos sincronizada con Prisma schema
- [x] `npx prisma db push` ejecutado exitosamente

---

## 📋 Instrucciones de Despliegue

### Paso 1: Configurar Variables de Entorno en Vercel

Ejecuta estos comandos en tu terminal o configura en el dashboard de Vercel:

```bash
# Requeridas
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production

# Opcionales (pero recomendadas)
vercel env add SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add NEXT_PUBLIC_SENTRY_DSN production

# Opcionales (Supabase para storage)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Opcionales (Stripe para facturación)
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

**Valores de ejemplo:**

```bash
# Generar NEXTAUTH_SECRET
openssl rand -base64 32

# URLs típicas
NEXTAUTH_URL=https://tu-app.vercel.app
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Paso 2: Desplegar a Staging

```bash
# Desplegar a staging (preview)
vercel

# Verificar deployment
vercel ls
```

### Paso 3: Verificar Staging

```bash
# Ejecutar checks de verificación
node scripts/staging-check.js https://tu-app-git-main-username.vercel.app

# O manualmente verificar:
# 1. https://tu-app.vercel.app/api/health (debe retornar "healthy")
# 2. https://tu-app.vercel.app/login (debe cargar)
# 3. https://tu-app.vercel.app/ (landing page)
```

### Paso 4: Desplegar a Producción

```bash
# Desplegar a producción
vercel --prod

# Verificar logs
vercel logs --production
```

---

## 🔍 Post-Deploy Checklist

### Inmediato (después del deploy)
- [ ] `/api/health` retorna `status: healthy`
- [ ] Login page carga sin errores
- [ ] Landing page carga correctamente
- [ ] No errores en Vercel logs

### Primeras 24 horas
- [ ] Crear cuenta de prueba
- [ ] Crear un lead
- [ ] Crear una unidad
- [ ] Verificar Sentry recibe errores (si ocurren)
- [ ] Revisar rate limiting funciona (429 después de muchos requests)

### Semana 1
- [ ] Configurar dominio personalizado (opcional)
- [ ] Configurar SSL/HTTPS (automático en Vercel)
- [ ] Revisar analytics de Vercel
- [ ] Configurar backups de base de datos (Neon)

---

## 🚨 Troubleshooting

### Error: "DATABASE_URL is not set"
**Solución:** Verificar que las variables de entorno están configuradas en Vercel Dashboard > Settings > Environment Variables

### Error: "NEXTAUTH_SECRET must be at least 32 characters"
**Solución:** Generar nuevo secret: `openssl rand -base64 32` y actualizar en Vercel

### Error: "Sentry DSN is not set"
**Solución:** Configurar SENTRY_DSN o desactivar Sentry temporalmente eliminando `withSentryConfig` de `next.config.js`

### Error: "Rate limit exceeded"
**Solución:** Es el comportamiento esperado. Si necesitas más requests, ajusta `maxRequests` en `lib/rate-limit.ts`

---

## 📊 Métricas a Monitorear

### Vercel Dashboard
- Build time
- Error rate
- Function duration
- Data transfer

### Sentry (si configurado)
- Errors per minute
- Performance issues
- User feedback

### Base de Datos (Neon)
- Connection count
- Query duration
- Storage usage

---

## 🔄 Rollback (si es necesario)

```bash
# Ver deployments anteriores
vercel ls

# Rollback a versión anterior
vercel --rollback
```

---

## 📝 Notas Importantes

1. **Sentry + Turbopack:** Hay advertencias de compatibilidad pero el build funciona. Sentry está configurado con `turbopack: {}` en next.config.js.

2. **Rate Limiting:** Es en memoria (no distribuido). Para alta escala, migrar a Redis o Vercel KV.

3. **Prisma:** En serverless, la primera request puede ser lenta (cold start). Considerar warm-up con cron job.

4. **Supabase:** Es opcional. Si no se configura, las funciones de storage de imágenes no funcionarán pero el resto de la app sí.

5. **Stripe:** Es opcional. Si no se configura, la facturación no funcionará.

---

## 🎉 Listo para Lanzar

Tu aplicación está configurada y lista para producción. ¡Buena suerte con el lanzamiento!
