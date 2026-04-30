# NextAuth Configuration for Production

## ⚠️ CRITICAL: Update These Before Deploying to Production

The following variables in `.env` and `.env.local` are **development-only defaults**:

```env
NEXTAUTH_SECRET="zV+SPxkauqvQgOcDh9Wtiq+MuY5hv7D3Me5vp+N3X+Q="
NEXTAUTH_URL="http://localhost:3000"
```

---

## Production Requirements

### 1. Generate a New NEXTAUTH_SECRET

**NEVER use the development secret in production.** Generate a new one:

```bash
# On your machine or CI/CD
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Example output:
# abc123defghijklmnopqrstuvwxyz1234567890==
```

**Store it securely:**
- If deploying to **Vercel**: Add to Environment Variables in Vercel Dashboard
- If deploying elsewhere: Use a secrets manager (Hashicorp Vault, AWS Secrets Manager, etc.)

### 2. Set NEXTAUTH_URL to Your Production Domain

```env
# Development (local)
NEXTAUTH_URL="http://localhost:3000"

# Staging (example)
NEXTAUTH_URL="https://staging.concesionaria.com"

# Production (example)
NEXTAUTH_URL="https://app.concesionaria.com"
```

**Important:** NEXTAUTH_URL must match your deployment domain exactly, including protocol (http/https).

---

## Vercel Deployment Checklist

If deploying to Vercel:

1. Go to **Project Settings → Environment Variables**
2. Add/Update:
   - `NEXTAUTH_SECRET` → New generated value
   - `NEXTAUTH_URL` → Your production domain (e.g., `https://app.vercel.app`)
   - `DATABASE_URL` → Your Neon PostgreSQL connection string
   - `DATABASE_URL_UNPOOLED` → Your Neon unpooled connection string

3. **Important:** Set these for all environments (Production, Preview, Development)

4. Redeploy after adding variables

---

## Testing After Deployment

After deploying with new NEXTAUTH_SECRET and NEXTAUTH_URL:

```
GET /api/diag
```

Should show:
```json
{
  "env": {
    "HAS_NEXTAUTH_SECRET": true,
    "HAS_NEXTAUTH_URL": true
  }
}
```

```
GET /api/diag/auth
```

Before login should show:
```json
{
  "environment": {
    "HAS_NEXTAUTH_SECRET": true,
    "HAS_NEXTAUTH_URL": true,
    "NEXTAUTH_URL": "https://your-domain.com"
  }
}
```

After login should show:
```json
{
  "session": { "status": "SUCCESS" },
  "token": { "status": "SUCCESS" }
}
```

---

## Common Mistakes to Avoid

❌ **Using the same NEXTAUTH_SECRET in development and production**
- Always generate new secrets for each environment

❌ **NEXTAUTH_URL doesn't match the deployment domain**
- If your site is `https://app.vercel.app`, set `NEXTAUTH_URL="https://app.vercel.app"`
- Including or excluding `www` matters — be consistent

❌ **Forgetting to set variables in Vercel Dashboard**
- Environment variables must be set in **both** `.env` AND the Vercel Dashboard
- `.env` files are gitignored and won't be used in deployment

❌ **Using HTTP in production**
- Always use HTTPS in production: `NEXTAUTH_URL="https://..."`
- NextAuth enforces secure cookies in production

---

## If Authentication Still Fails After Deployment

1. Check Vercel logs: `vercel logs --prod`
2. Run diagnostics: Visit `/api/diag` and `/api/diag/auth`
3. Verify database connection: Visit `/api/health`
4. Check browser cookies: DevTools → Application → Cookies
5. Check browser console for errors: DevTools → Console

---

## What This Fixes

The missing `NEXTAUTH_SECRET` and `NEXTAUTH_URL` was causing:
- ❌ JWT tokens could not be signed/validated
- ❌ Cookies were not being set correctly
- ❌ Users appeared not authenticated
- ❌ Old/stale cookies persisted and blocked new logins
- ❌ Page wouldn't load until `F12 → Clear site data`

With these variables configured:
- ✅ NextAuth can properly sign and validate JWT tokens
- ✅ Cookies are set correctly with proper validation
- ✅ Sessions persist across page refreshes
- ✅ No need to manually clear site data
- ✅ Authentication works consistently
