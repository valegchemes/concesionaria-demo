# Diagnostic Guide: Page Load Issue

## Problema
La página de la aplicación no carga hasta que se hace **F12 → Application → Clear site data** (limpiar datos del sitio). Después de eso, todo funciona normalmente.

**Síntoma Clave:** Esto indica un problema de **cookies o sesión de NextAuth que queda bloqueada/corrupta**.

---

## Plan de Diagnóstico

### Paso 1: Verificar Configuración de Entorno
```
GET /api/diag
```

**Qué verificar:**
- ✅ `HAS_NEXTAUTH_SECRET` = `true`
- ✅ `HAS_NEXTAUTH_URL` = `true`
- ✅ `SECRET_LENGTH` ≥ 32 caracteres
- ✅ `HAS_KV` = `true` (para caché de Redis)

Si alguno está en `false`, ese es el problema.

**Causa Común:**
```
HAS_NEXTAUTH_SECRET: false → Agregar NEXTAUTH_SECRET a .env.local o Vercel
HAS_NEXTAUTH_URL: false → Agregar NEXTAUTH_URL (ej: http://localhost:3000 o https://app.example.com)
```

---

### Paso 2: Verificar Estado de Sesión

**Antes de hacer login:**
```
GET /api/diag/auth
```

Debería mostrar:
```json
{
  "session": { "status": "NO_SESSION" },
  "token": { "status": "NO_TOKEN" }
}
```

Esto es **normal** — no hay sesión porque no has iniciado sesión.

---

### Paso 3: Limpiar Cookies Viejas

Si tiene cookies rotas de sesiones anteriores:
```
GET /api/diag/clear-auth
```

Esto devuelve:
```json
{
  "message": "Cleared all next-auth cookies",
  "nextStep": "Refresh the page and try logging in again"
}
```

---

### Paso 4: Hacer Login

1. Ve a `/login`
2. Ingresa credenciales válidas
3. Haz click en "Ingresar al sistema"

**Si el login falla:**
- Revisa DevTools → Console para errores
- Verifica que la credencial sea correcta
- Revisa `/api/diag` para verificar que base de datos esté disponible

---

### Paso 5: Verificar Sesión Después de Login

**Inmediatamente después de login, visita:**
```
GET /api/diag/auth
```

Debería mostrar algo como:
```json
{
  "session": {
    "status": "SUCCESS",
    "data": {
      "userId": "abc123",
      "email": "user@example.com",
      "companyId": "company123",
      "role": "ADMIN"
    }
  },
  "token": {
    "status": "SUCCESS",
    "data": {
      "id": "abc123",
      "email": "user@example.com",
      "companyId": "company123"
    }
  }
}
```

**Escenarios problemáticos:**

#### ❌ Escenario 1: Sesión NO existe, pero el usuario se ve logueado
```json
{
  "session": { "status": "NO_SESSION" },
  "token": { "status": "SUCCESS", "data": { ... } }
}
```
**Causa:** Problema con la estrategia de sesión o callbacks de NextAuth  
**Solución:** Revisar `auth-options.ts` → `session.strategy` debe ser `'jwt'`

#### ❌ Escenario 2: Token tampoco existe
```json
{
  "session": { "status": "NO_SESSION" },
  "token": { "status": "NO_TOKEN" }
}
```
**Causa:** Las cookies de NextAuth no se están guardando correctamente  
**Solución:** Ver sección "Cookies no se guardan" abajo

#### ❌ Escenario 3: Cookies oversized
```json
{
  "issues": [
    "Oversized cookie: __Secure-next-auth.session-token (4500 bytes > 4KB limit)"
  ]
}
```
**Causa:** El JWT es demasiado grande (>4KB)  
**Solución:** Revisar qué campos se están guardando en el JWT (ver `auth-options.ts`)

---

## Soluciones Comunes

### Problema: Cookies No Se Guardan Después de Login

**Síntomas:**
- Login parece exitoso (redirecciona a `/app/dashboard`)
- Pero `/api/diag/auth` muestra `NO_SESSION` y `NO_TOKEN`
- Refrescar la página lo devuelve a `/login`

**Causas Posibles:**

1. **NEXTAUTH_URL no está configurada o es incorrecta**
   ```env
   # ❌ Incorrecto (o no configurado)
   # NEXTAUTH_URL=http://localhost:3000
   
   # ✅ Correcto
   NEXTAUTH_URL=http://localhost:3000
   ```

2. **El JWT/token es demasiado grande**
   - Verificar en `/api/diag/auth` si hay `"Oversized cookie"` en `issues`
   - Si es así, revisar `lib/auth.ts` → `authorize()` → Quitar campos innecesarios del usuario retornado
   - **Nota:** `avatarUrl` y `logoUrl` ya NO se guardan en el JWT (se cargan del DB en layout)

3. **Problema de serialización del usuario**
   - El objeto de usuario retornado por `authorize()` no se puede serializar correctamente
   - Verificar `app/api/auth/[...nextauth]/auth-options.ts` → `authorize()` → Retornar solo campos primitivos (strings, números)

4. **`NEXTAUTH_SECRET` no es válido**
   ```env
   # ❌ Demasiado corto
   NEXTAUTH_SECRET=abc123
   
   # ✅ Mínimo 32 caracteres (genera con: openssl rand -base64 32)
   NEXTAUTH_SECRET=gYfNDK/kLJ...
   ```

---

### Problema: Cookies Rotas/Stale que No Se Limpian Automáticamente

**Síntomas:**
- Después de logout, la página sigue mostrando contenido logueado
- `/api/diag/auth` muestra token viejo
- F12 → Clear Site Data → Funciona

**Solución:**

1. Limpiar cookies manualmente:
   ```
   GET /api/diag/clear-auth
   ```

2. Refrescar la página

3. Hacer login nuevamente

---

### Problema: Middleware Limpia Cookies Constantemente (Ciclo Infinito)

**Síntomas:**
- Login parece funcionar, pero al refrescar se va a `/login`
- Las cookies se ven vacías en DevTools
- Log muestra: `"clearNextAuthCookies"` constantemente

**Causa:** El middleware detecta que no hay sesión válida y limpia las cookies, pero éstas nunca se vuelven a crear.

**Solución:**

1. Verificar que `getToken()` puede leer el token:
   ```
   GET /api/diag/auth
   ```
   El campo `token.data` debería tener valores

2. Si el token existe pero `session` no:
   - Revisar `auth-options.ts` → `callbacks.session`
   - Asegurarse que está mapeando correctamente: `session.user.id = token.id`

3. Si nada funciona, limpiar y reintentar:
   ```
   GET /api/diag/clear-auth
   → Ir a /login
   → Hacer login nuevamente
   → Visitar /api/diag/auth para verificar
   ```

---

## Checklist Final

- [ ] `GET /api/diag` muestra `HAS_NEXTAUTH_SECRET: true`
- [ ] `GET /api/diag` muestra `HAS_NEXTAUTH_URL: true`
- [ ] Limpiar cookies: `GET /api/diag/clear-auth`
- [ ] Ir a `/login` y hacer login
- [ ] `GET /api/diag/auth` muestra `session.status: "SUCCESS"`
- [ ] `GET /api/diag/auth` muestra `token.status: "SUCCESS"`
- [ ] Ir a `/app/dashboard` y verificar que se carga correctamente
- [ ] Refrescar la página (`F5`) — debe seguir cargando correctamente

---

## Si Sigue Fallando

1. **Recopila información:**
   ```
   GET /api/diag → Copiar JSON completo
   GET /api/diag/auth → Copiar JSON completo
   ```

2. **Revisa los logs:**
   - DevTools → Console → Buscar errores (en rojo)
   - DevTools → Network → Filtrar por `signin` / `session` — Ver responses

3. **Verifica base de datos:**
   ```
   GET /api/health
   ```
   Debería mostrar que base de datos está OK

4. **Reporta el problema con:**
   - Output de `/api/diag`
   - Output de `/api/diag/auth`
   - Screenshot de DevTools → Console
   - `.env.local` (sin valores sensibles, solo nombres de variables)
