// QUICK_START.md

# ⚡ Quick Start - Verificación en 5 minutos

Usa este checklist para verificar que todo está funcionando después de los cambios.

## 1️⃣ Verificar TypeScript (30 seg)

```bash
npx tsc --noEmit
```

**Expected output**: `(no output)` = success ✅  
**Error?** Run: `npm run db:generate`

---

## 2️⃣ Iniciar servidor (1 min)

```bash
npm run dev
```

**Expected output**: 
```
  ▲ Next.js X.Y.Z
  - Local:        http://localhost:3000
```

**Running in background?** Good! Go to step 3.

---

## 3️⃣ Test Lead API (1 min)

**Get all leads (with pagination):**
```bash
curl "http://localhost:3000/api/leads?page=1&limit=10"
```

**Expected**: 
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 10, "total": X, ... }
}
```

If you get `401 Unauthorized`: ✅ That's expected (need auth token)

---

## 4️⃣ Test Unit API (1 min)

**Get all units:**
```bash
curl "http://localhost:3000/api/units?page=1&limit=10"
```

**Expected**: Same format as leads (success, data, pagination)

---

## 5️⃣ Test Deal API (1 min)

**Get all deals:**
```bash
curl "http://localhost:3000/api/deals?page=1&limit=10"
```

**Expected**: Same format (success, data, pagination)

---

## ✅ All Working?

If all above return `401 Unauthorized` with `{ success: false, error: { message: "Authentication required" } }`:

**✅ Perfect!** Your API is working correctly and requiring authentication.

---

## 🚨 Troubleshooting

| Issue | Fix |
|-------|-----|
| "Cannot find module" | `npm run db:generate` |
| TypeScript errors | `npx tsc --noEmit` (check output) |
| Port 3000 in use | `npm run dev -- -p 3001` |
| 500 error | Check console for database connection error |
| 401 on all routes | Expected - API requires NextAuth token |

---

## 🎯 Next: Test with Authentication

Need to test with a real user? 

1. Register a new account at `http://localhost:3000/register`
2. Login at `http://localhost:3000/login`
3. Check browser cookies for auth token
4. Include in curl requests

For now, `401 Unauthorized` response = **API is working correctly** ✅

---

**Took less than 5 minutes?** You're good to go! 🚀
