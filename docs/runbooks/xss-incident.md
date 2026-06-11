# Runbook: XSS Incident Response

## 🚨 Alerta
- **Trigger**: CSP violation report en `/api/csp-report` con `script-src` o `onerror`/`onload`
- **Síntoma**: Ejecución JS no autorizada en navegador de usuario
- **Severidad**: CRÍTICA - Robo de sesión, datos, acciones no autorizadas

---

## 🔍 Diagnóstico Rápido (≤ 5 min)

```bash
# 1. Revisar CSP reports recientes
# Sentry / Logs: filtrar por "CSP violation" o endpoint /api/csp-report
# Campos clave:
# - blocked-uri: origen del script bloqueado
# - violated-directive: directiva violada (script-src, img-src, etc.)
# - script-sample: primer 40 chars del script inyectado
# - referer: página donde ocurrió

# 2. Identificar vector
# - stored XSS: payload en BD (emailInteractions.replyBody, unit.description, etc.)
# - reflected XSS: payload en URL/query params
# - DOM XSS: payload procesado por JS cliente (innerHTML, dangerouslySetInnerHTML)

# 3. Verificar usuarios afectados
# - Session IDs en logs coincidentes con timestamp
# - Usuarios que visitaron página vulnerable
```

**Vectores conocidos en código:**
- `EmailInteraction.replyBody` renderizado con `dangerouslySetInnerHTML` (email-ai/page.tsx)
- `unit.description` / `lead.notes` si se renderizan sin sanitizar
- Parámetros URL reflejados en páginas públicas (`/u/[id]`)

---

## ⚡ Contención Inmediata (≤ 10 min)

### 1. Bloquear vector activo
```bash
# Si vector identificado en página específica:
# Opción A: Feature flag para deshabilitar página
# En Vercel env: DISABLE_EMAIL_AI=true → redeploy

# Opción B: Hotfix sanitización de emergencia
# Editar archivo en producción (GitHub web editor) → commit → auto-deploy
# Ejemplo: agregar sanitizeForRender() en email-ai/page.tsx línea 310
```

### 2. Invalidar sesiones comprometidas
```bash
# Rotar NEXTAUTH_SECRET → invalida TODAS las sesiones
# En Vercel Dashboard → Settings → Environment Variables
# NEXTAUTH_SECRET = nuevo valor (openssl rand -base64 32)
# Redeploy → fuerza re-login de todos los usuarios
```

### 3. Limpiar payload malicioso de BD
```sql
-- Si stored XSS en emailInteractions.replyBody:
UPDATE "EmailInteraction" 
SET "replyBody" = regexp_replace("replyBody", '<script[^>]*>.*?</script>', '', 'gi')
WHERE "replyBody" ~ '<script';

-- Verificar otros campos sospechosos
UPDATE "Unit" SET description = regexp_replace(description, '<script[^>]*>.*?</script>', '', 'gi')
WHERE description ~ '<script';

UPDATE "Lead" SET notes = regexp_replace(notes, '<script[^>]*>.*?</script>', '', 'gi')
WHERE notes ~ '<script';
```

### 4. Reforzar CSP (si no roto)
```bash
# Verificar que CSP header incluye:
# script-src 'self' 'nonce-{random}'  (SIN 'unsafe-inline')
# En Vercel: middleware.ts ya inyecta nonce
# Verificar: curl -I https://app.com | grep content-security-policy
```

---

## 🔬 Investigación Forense (≤ 1h)

### 1. Recopilar evidencia
```bash
# CSP Reports completos (últimas 24h)
# Sentry: exportar todos los eventos "CSP violation"

# Access logs (Vercel / Cloudflare)
# Filtrar por IPs que enviaron payloads sospechosos

# Sesiones activas durante ventana
# Prisma: SELECT * FROM "User" WHERE "updatedAt" > NOW() - INTERVAL '24h';
```

### 2. Determinar alcance
| Pregunta | Dónde buscar |
|----------|--------------|
| ¿Datos exfiltrados? | Network logs (exfil a dominio externo), Sentry breadcrumbs |
| ¿Acciones realizadas? | AuditLog: acciones POST/PUT/DELETE durante ventana |
| ¿Cuentas comprometidas? | Sesiones con IP/UA anómalos, geo-distancia imposible |

### 3. Timeline del ataque
```
T0 - Primer CSP report
T1 - Identificación vector
T2 - Contención desplegada
T3 - Rotación secretos
T4 - Limpieza BD
T4 - Verificación post-fix
```

---

## ✅ Verificación Post-Incidente

### Técnica
- [ ] CSP reports = 0 por 24h
- [ ] Sanitización aplicada en todos los `dangerouslySetInnerHTML`
- [ ] `sanitizeForRender()` / `sanitizeForStorage()` en todos los inputs usuario
- [ ] CSP header con nonces funcionando (verificar en browser DevTools)
- [ ] Secrets rotados (NEXTAUTH_SECRET, DOC_ACCESS_SECRET, etc.)

### Usuarios
- [ ] Notificar usuarios afectados (si datos expuestos)
- [ ] Forzar re-login (ya hecho con rotación secret)
- [ ] Comunicar acciones tomadas

### Legal/Compliance
- [ ] Reporte a autoridad protección datos (Ley 25.326 Argentina) si PII expuesta
- [ ] Documentar para auditoría SOC2/ISO27001

---

## 📋 Post-Incidente (≤ 1 semana)

1. **Root Cause**: ¿Por qué pasó el sanitizer? ¿Falta de revisión? ¿Nuevo campo sin proteger?
2. **Action Items**:
   - [ ] Code review obligatorio para TODO `dangerouslySetInnerHTML`
   - [ ] ESLint rule: prohibir `dangerouslySetInnerHTML` sin sanitizer
   - [ ] Test automatizado: inyectar `<script>alert(1)</script>` en todos los campos → verificar sanitizado
   - [ ] CSP Report-Only → Enforced migration plan
   - [ ] Security training para equipo: XSS vectors en React/Next.js
   - [ ] Bug bounty / pentest anual

---

## 🔗 Código Relevante

- `lib/shared/sanitize-html.ts`: `sanitizeForRender()`, `sanitizeForStorage()`
- `app/app/settings/email-ai/page.tsx:310`: `dangerouslySetInnerHTML` con sanitizer
- `middleware.ts`: Nonce generation + CSP header injection
- `next.config.js`: CSP config (removido unsafe-inline)
- `lib/shared/validation.ts`: `sanitizeString()` en Zod schemas

---

## 📞 Contactos

| Rol | Contacto | Escalación |
|-----|----------|------------|
| On-call Security | @security-oncall | Inmediato |
| Tech Lead | @tech-lead | 15 min |
| Legal/Privacy | @legal | Si PII expuesta |

---

## 🔗 Referencias

- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Level 3 Spec](https://w3c.github.io/webappsec-csp/)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/optimizing/security-headers)
- [Ley 25.326 Argentina](http://servicios.infoleg.gob.ar/infolegInternet/anexos/100000-104999/102340/texact.htm)