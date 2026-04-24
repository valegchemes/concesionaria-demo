# Guía de Despliegue - Paso a Paso

## 📋 Resumen de Acciones

### 1️⃣ Obtener Valores de Supabase

1. Ir a [https://app.supabase.com](https://app.supabase.com)
2. Seleccionar tu proyecto
3. Ir a **Project Settings** → **API**
4. Copiar estos valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2️⃣ Ejecutar SQL en Supabase

1. En Supabase Dashboard, ir a **SQL Editor**
2. Click **New Query**
3. Copiar contenido de `supabase-schema.sql`
4. Pegar y ejecutar (▶️ Run)

### 3️⃣ Obtener BLOB Token de Vercel

1. Ir a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Ir a tu proyecto
3. **Storage** tab → **Create Store** → Select **Blob**
4. Copiar **Read/Write Token**

### 4️⃣ Ejecutar Deploy Automatizado

**Opción A - Script Interactivo (Git Bash/Terminal):**
```bash
# En Git Bash o terminal con bash
bash deploy.sh
```

**Opción B - Comandos Manuales:**
```bash
# Login a Vercel (si no estás logueado)
vercel login

# Agregar variables de entorno
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Pegar: https://your-project.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Pegar: eyJhbGciOiJIUzI1NiIs...

vercel env add BLOB_READ_WRITE_TOKEN production
# Pegar: vercel_blob_rw_...

vercel env add NEXTAUTH_SECRET production
# Pegar: (generar con: openssl rand -base64 32)

# Deploy a producción
vercel --prod
```

---

## 🎯 Comandos Windows (PowerShell)

Si usas PowerShell:
```powershell
# Variables
$SUPABASE_URL = "https://tu-proyecto.supabase.co"
$SUPABASE_KEY = "tu-anon-key"
$BLOB_TOKEN = "vercel_blob_rw_..."
$AUTH_SECRET = (openssl rand -base64 32)

# Configurar
vercel env add NEXT_PUBLIC_SUPABASE_URL production
$SUPABASE_URL | vercel env add NEXT_PUBLIC_SUPABASE_URL production

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
$SUPABASE_KEY | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

vercel env add BLOB_READ_WRITE_TOKEN production
$BLOB_TOKEN | vercel env add BLOB_READ_WRITE_TOKEN production

vercel env add NEXTAUTH_SECRET production
$AUTH_SECRET | vercel env add NEXTAUTH_SECRET production

# Deploy
vercel --prod
```

---

## ✅ Checklist Post-Deploy

- [ ] SQL ejecutado en Supabase
- [ ] Variables configuradas en Vercel
- [ ] Deploy completado sin errores
- [ ] `/login` carga correctamente
- [ ] Login funciona con credenciales
- [ ] `/admin` muestra formulario
- [ ] Subir unidad con imágenes funciona

---

## 🆘 Troubleshooting

### "Error: Project not found"
```bash
# Vincular proyecto existente
vercel link

# O crear nuevo
vercel
```

### "Error: Environment variable already exists"
```bash
# Actualizar variable existente
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
```

### "Build failed"
```bash
# Ver logs
vercel logs --production

# Re-deploy
vercel --prod
```

---

## 📞 Valores Necesarios

Necesito que me proporciones estos valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_
```

O ejecuta el script `deploy.sh` interactivamente.
