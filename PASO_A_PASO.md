# 🚀 Guía Paso a Paso - Despliegue Manual

## ANTES DE EMPEZAR

Asegúrate de tener:
- ✅ Cuenta en [Vercel](https://vercel.com) (login hecho)
- ✅ Cuenta en [Supabase](https://supabase.com) (proyecto creado)
- ✅ Cuenta en GitHub (para el deploy)

---

## PASO 1: Crear Proyecto en Vercel (Si no existe)

### 1.1 Inicializar proyecto
```powershell
# En PowerShell, en la carpeta del proyecto
vercel
```

Te preguntará:
- `Set up and deploy "..."?` → Escribe `y` y Enter
- `Which scope?` → Selecciona tu cuenta con flechas y Enter
- `Link to existing project?` → Escribe `n` y Enter
- `What's your project name?` → Presiona Enter (acepta default)
- `In which directory is your code located?` → Presiona Enter
- `Want to modify these settings?` → Escribe `n` y Enter

### 1.2 Verificar que Vercel está conectado
```powershell
vercel status
```
Debe mostrar tu proyecto conectado.

---

## PASO 2: Obtener Valores de Supabase

### 2.1 Ir a Supabase Dashboard
1. Abre navegador: https://app.supabase.com
2. Inicia sesión
3. Selecciona tu proyecto (o crea uno nuevo)

### 2.2 Copiar valores del proyecto
1. En el menú lateral, clic en **Project Settings** (icono de engranaje)
2. Selecciona pestaña **API**
3. Busca estas secciones:

**Project URL:**
```
https://xxxxxxxxxxxx.supabase.co
```
→ Copia esto, lo necesitarás

**Project API keys:**
```
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
→ Copia la clave `anon public` COMPLETA

### 2.3 Guardar valores temporalmente
Abre el Bloc de notas y pega:
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(copia completa)
```

---

## PASO 3: Ejecutar SQL en Supabase

### 3.1 Abrir SQL Editor
1. En Supabase Dashboard, menú lateral
2. Click en **SQL Editor**
3. Click botón **New Query** (arriba a la izquierda)

### 3.2 Copiar y pegar SQL
1. Abre el archivo `supabase-schema.sql` de este proyecto
2. Selecciona TODO el contenido (Ctrl+A, Ctrl+C)
3. Vuelve a Supabase SQL Editor
4. Pega el contenido (Ctrl+V)

### 3.3 Ejecutar SQL
1. Click en botón **Run** (▶️ verde arriba a la derecha)
2. Espera a que diga "Success" en verde
3. Cierra la pestaña

**Verificación:** En el menú lateral, click en **Table Editor** → Debes ver la tabla `units` creada.

---

## PASO 4: Obtener Vercel Blob Token

### 4.1 Crear Blob Store
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Click en pestaña **Storage**
4. Click **Create Store**
5. Selecciona **Blob**
6. Click **Continue**
7. Escribe un nombre (ej: `concesionaria-blob`)
8. Click **Create**

### 4.2 Copiar Token
1. Una vez creado, verás el dashboard del Blob Store
2. Busca la sección **Quickstart**
3. Copia el valor que empieza con:
   ```
   vercel_blob_rw_xxxxxxxxxxxxxxxx
   ```

### 4.3 Guardar en bloc de notas
Agrega a tu bloc de notas:
```
BLOB_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx
```

---

## PASO 5: Configurar Variables de Entorno en Vercel

### 5.1 Ir a configuración del proyecto
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Click en pestaña **Settings** (arriba)
4. En el menú lateral izquierdo, click **Environment Variables**

### 5.2 Agregar variables una por una

**Variable 1 - SUPABASE_URL:**
1. Click en **Add** o **Add Another**
2. Name: `NEXT_PUBLIC_SUPABASE_URL`
3. Value: (pega tu URL de Supabase)
4. Environments: ✅ Production ✅ Preview ✅ Development
5. Click **Save**

**Variable 2 - SUPABASE_KEY:**
1. Click **Add Another**
2. Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Value: (pega tu anon key COMPLETA)
4. Environments: ✅ Production ✅ Preview ✅ Development
5. Click **Save**

**Variable 3 - BLOB_TOKEN:**
1. Click **Add Another**
2. Name: `BLOB_READ_WRITE_TOKEN`
3. Value: (pega tu blob token)
4. Environments: ✅ Production ✅ Preview ✅ Development
5. Click **Save**

**Variable 4 - NEXTAUTH_SECRET (generar):**
1. Abre PowerShell
2. Ejecuta:
   ```powershell
   openssl rand -base64 32
   ```
3. Copia el resultado (largo string aleatorio)
4. En Vercel, click **Add Another**
5. Name: `NEXTAUTH_SECRET`
6. Value: (pega el resultado de openssl)
7. Environments: ✅ Production ✅ Preview ✅ Development
8. Click **Save**

---

## PASO 6: Deploy a Producción

### Opción A: Desde Vercel Dashboard (Más fácil)
1. En tu proyecto de Vercel, click en pestaña **Deployments**
2. Busca el deploy más reciente
3. Click en los **3 puntos** (⋯)
4. Click **Promote to Production**

### Opción B: Desde Terminal
```powershell
# Asegúrate de estar en la carpeta del proyecto
cd "E:\proyectos\consencionaria windsurf"

# Deploy a producción
vercel --prod
```

Espera a que termine. Verás:
```
🔍 Inspect: https://vercel.com/.../...
✅ Production: https://tu-app.vercel.app
```

---

## PASO 7: Verificar Despliegue

### 7.1 Abrir URL de producción
Copia la URL de producción (ej: `https://tu-app.vercel.app`) y ábrela en navegador.

### 7.2 Verificar páginas
1. **Login**: `https://tu-app.vercel.app/login`
   - Debe cargar formulario de login
   - Si tienes cuenta de Supabase Auth, prueba login

2. **Admin** (requiere login): `https://tu-app.vercel.app/admin`
   - Redirigirá a login si no estás autenticado
   - Si estás autenticado, mostrará formulario de unidades

### 7.3 Probar flujo completo
1. Crea cuenta en `/login` (Sign Up en Supabase primero)
2. Inicia sesión
3. Ve a `/admin`
4. Crea una unidad con imágenes
5. Verifica en Supabase Table Editor que se guardó

---

## 🆘 Solución de Problemas

### "No such file or directory" al ejecutar vercel
```powershell
# Instalar Vercel CLI globalmente
npm i -g vercel
```

### "You must log in first"
```powershell
vercel login
# Te abrirá navegador para autenticar
```

### Error de build
1. Ve a Vercel Dashboard → tu proyecto → **Deployments**
2. Click en el deploy fallido
3. Click en **Build Logs**
4. Busca el error en rojo

### Variables no aparecen
A veces Vercel no detecta cambios. Fuerza redeploy:
```powershell
vercel --prod
```

### SQL no crea la tabla
1. Verifica que ejecutaste TODO el contenido de `supabase-schema.sql`
2. En Supabase, ve a **Table Editor** y verifica si existe `units`
3. Si no existe, vuelve al Paso 3

---

## ✅ Checklist Final

- [ ] Paso 1: Proyecto Vercel creado/conectado
- [ ] Paso 2: Valores de Supabase copiados
- [ ] Paso 3: SQL ejecutado en Supabase
- [ ] Paso 4: Blob Store creado y token copiado
- [ ] Paso 5: 4 variables de entorno configuradas
- [ ] Paso 6: Deploy a producción exitoso
- [ ] Paso 7: Páginas cargan correctamente

---

## 📞 Ayuda

Si algo falla, necesito saber:
1. ¿En qué paso te quedaste?
2. ¿Qué error aparece?
3. ¿Ves la tabla `units` en Supabase?
4. ¿Las 4 variables aparecen en Vercel Settings?
