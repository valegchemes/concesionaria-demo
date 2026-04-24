# Guía de Configuración: Supabase + Vercel Blob

## Paso 1: Configurar Supabase

### 1.1 Crear un proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Crea un nuevo proyecto
4. Obtén tus credenciales:
   - **NEXT_PUBLIC_SUPABASE_URL**: La URL del proyecto (ej: `https://xxxxx.supabase.co`)
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY**: La clave pública anónima
   - **SUPABASE_SERVICE_ROLE_KEY**: La clave de rol de servicio (usa esto solo en el servidor)

### 1.2 Actualizar variables de entorno
Actualiza tu archivo `.env.local` con las credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL="tu_supabase_url_aqui"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu_anon_key_aqui"
SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key_aqui"
```

### 1.3 Crear la tabla en Supabase
1. En el dashboard de Supabase, ve a **SQL Editor**
2. Copia y pega el contenido del archivo `prisma/units-table.sql`
3. Ejecuta el script SQL

Este script creará:
- Tabla `units` con todos los campos necesarios
- Políticas de RLS (Row Level Security)
- Índices para mejor rendimiento

### 1.4 Configurar Autenticación en Supabase
1. Ve a **Authentication** en el panel de Supabase
2. En **Providers**, habilita "Email" (debe estar habilitado por defecto)
3. En **Email Templates**, personaliza los mensajes si lo deseas

## Paso 2: Configurar Vercel Blob

### 2.1 Obtener el token
1. Ve a [vercel.com](https://vercel.com)
2. Ve a tu proyecto deployado (o crea uno)
3. En **Settings** > **Storage** > **Blob**
4. Crea un nuevo token o copia el existente
5. Actualiza tu `.env.local`:

```env
BLOB_READ_WRITE_TOKEN="tu_vercel_blob_token_aqui"
```

## Paso 3: Flujo de Funcionamiento

### Registro de Usuario
1. El usuario llena el formulario de registro en `/register`
2. Supabase crea el usuario automáticamente con autenticación por email
3. Se redirige al usuario a `/app/units/new`

### Creación de Unidad
1. El usuario accede a `/app/units/new`
2. Completa el formulario con datos de la unidad:
   - Marca, modelo, año, precio, descripción
   - Sube imágenes (máximo 5, 5MB cada una)
3. Las imágenes se suben directamente a Vercel Blob desde el navegador
4. Vercel Blob devuelve las URLs de las imágenes
5. El formulario envía los datos a `/api/units` con las URLs de Vercel Blob
6. La API guarda los datos en Supabase usando la tabla `units`

### Catálogo Público
- `GET /api/units` - Cualquiera puede ver todas las unidades
- `GET /api/units/[id]` - Ver detalles de una unidad específica
- `PUT /api/units/[id]` - Solo el dueño puede editar su unidad
- `DELETE /api/units/[id]` - Solo el dueño puede eliminar su unidad

## Componentes Implementados

### `lib/supabase.ts`
- Cliente público de Supabase para el navegador
- Función `createServerClient()` para operaciones en el servidor
- Tipos de TypeScript para la tabla `units`

### `lib/blob.ts`
- Utilidades para subir imágenes a Vercel Blob
- Funciones: `uploadImage()`, `deleteImage()`, `uploadMultipleImages()`

### `components/image-uploader.tsx`
- Componente React para subir múltiples imágenes
- Validación de tipos de archivo y tamaño
- Previsualización de imágenes subidas
- Client-side uploads directos a Vercel Blob

### `components/unit-form.tsx`
- Formulario completo para crear unidades
- Integración con ImageUploader
- Envío a `/api/units`

### Rutas API
- `app/api/units/route.ts` - GET (listar) y POST (crear)
- `app/api/units/[id]/route.ts` - GET, PUT, DELETE para unidades específicas

### Páginas
- `app/login/page.tsx` - Login con Supabase Auth
- `app/app/units/new/page.tsx` - Formulario para crear unidades

## Autenticación

### Login en Cliente
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

### Verificación en Servidor
Las rutas API verifican el token de autenticación desde el header `Authorization`:

```typescript
const token = request.headers.get('Authorization')?.replace('Bearer ', '')
const { data: userData } = await supabase.auth.getUser(token)
```

## Seguridad

### RLS (Row Level Security)
- Las políticas en Supabase aseguran que:
  - Solo usuarios autenticados puedan crear unidades
  - Los usuarios solo pueden editar/eliminar sus propias unidades
  - Cualquiera puede leer todas las unidades (catálogo público)

### Validación
- Validación en cliente (tipo, tamaño de archivos)
- Validación en servidor (campos requeridos, tipo de datos)
- Verificación de propiedad de unidades antes de editar/eliminar

## Próximos Pasos

1. **Completar el registro** (opcional)
   - Crea `app/register/page.tsx` si aún no existe

2. **Crear página de catálogo**
   - Página de listado de unidades públicas
   - Filtros por marca, año, precio, etc.

3. **Crear página de detalles**
   - Vista detallada de una unidad
   - Galería de imágenes

4. **Agregar búsqueda**
   - Búsqueda de unidades por marca, modelo, etc.

5. **Panel de usuario**
   - Ver unidades creadas por el usuario
   - Editar unidades existentes

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que hayas actualizado `.env.local` con las credenciales correctas
- Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "No autenticado" al crear unidades
- Asegúrate de tener un header `Authorization` válido con el token de Supabase
- El cliente debe estar autenticado en Supabase primero

### Las imágenes no se suben
- Verifica que `BLOB_READ_WRITE_TOKEN` esté correctamente configurado
- Comprueba que el navegador permite subidas de archivos
- Verifica el tamaño de las imágenes (máximo 5MB)

### Error al leer la tabla en Supabase
- Verifica que el script SQL se ejecutó correctamente
- Asegúrate de que RLS esté habilitado
- Comprueba que las políticas RLS se crearon correctamente
