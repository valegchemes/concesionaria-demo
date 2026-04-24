# Ejemplos de Uso de la API

## 1. Registro de Usuario

```typescript
// app/register/page.tsx
import { supabase } from '@/lib/supabase'

// Registrar usuario
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@example.com',
  password: 'password123',
  options: {
    data: {
      role: 'dealership_admin',
    },
  },
})

if (error) {
  console.error('Error al registrar:', error.message)
} else {
  console.log('Usuario creado:', data.user?.email)
}
```

## 2. Login de Usuario

```typescript
// app/login/page.tsx
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@example.com',
  password: 'password123',
})

if (error) {
  console.error('Error al iniciar sesión:', error.message)
} else {
  console.log('Sesión iniciada:', data.session?.user?.email)
}
```

## 3. Subir Imágenes a Vercel Blob

```typescript
// En un componente cliente
import { uploadMultipleImages } from '@/lib/blob'

async function subirFotos(archivos: File[]) {
  try {
    const urls = await uploadMultipleImages(archivos, (progress) => {
      console.log(`Progreso: ${progress}%`)
    })
    
    console.log('URLs de imágenes:', urls)
    return urls
  } catch (error) {
    console.error('Error al subir:', error)
  }
}

// Uso:
const input = document.querySelector<HTMLInputElement>('input[type="file"]')
if (input?.files) {
  const urls = await subirFotos(Array.from(input.files))
}
```

## 4. Crear Nueva Unidad

```typescript
// POST /api/units
async function crearUnidad() {
  const imageUrls = [
    'https://..../image1.jpg',
    'https://..../image2.jpg',
  ]

  const response = await fetch('/api/units', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`, // O el token de Supabase
    },
    body: JSON.stringify({
      brand: 'Toyota',
      model: 'Corolla',
      year: 2023,
      price: 25000,
      description: 'Auto en excelente estado, poco uso',
      images: imageUrls,
    }),
  })

  if (response.ok) {
    const unidad = await response.json()
    console.log('Unidad creada:', unidad)
    return unidad
  } else if (response.status === 401) {
    console.error('No autenticado')
  } else {
    const error = await response.json()
    console.error('Error:', error.error)
  }
}
```

## 5. Obtener Lista de Unidades

```typescript
// GET /api/units?limit=20&offset=0&status=available
async function obtenerUnidades(pagina: number = 1, limite: number = 20) {
  const offset = (pagina - 1) * limite

  const response = await fetch(
    `/api/units?limit=${limite}&offset=${offset}&status=available`
  )

  if (response.ok) {
    const { data, total, limit, offset } = await response.json()
    
    console.log(`Total de unidades: ${total}`)
    console.log(`Mostrando ${data.length} unidades`)
    
    return { unidades: data, total, paginas: Math.ceil(total / limite) }
  }
}

// Uso:
const { unidades, total, paginas } = await obtenerUnidades(1, 10)
unidades.forEach(u => {
  console.log(`${u.brand} ${u.model} (${u.year}) - $${u.price}`)
})
```

## 6. Obtener Detalle de Unidad

```typescript
// GET /api/units/[id]
async function obtenerUnidad(id: string) {
  const response = await fetch(`/api/units/${id}`)

  if (response.ok) {
    const unidad = await response.json()
    console.log('Unidad:', unidad)
    
    // Acceder a propiedades
    console.log(`${unidad.brand} ${unidad.model}`)
    console.log(`Precio: $${unidad.price}`)
    console.log(`Imágenes: ${unidad.images.length}`)
    unidad.images.forEach((img: string) => {
      console.log(`Imagen: ${img}`)
    })
    
    return unidad
  } else if (response.status === 404) {
    console.error('Unidad no encontrada')
  }
}

// Uso:
const unidad = await obtenerUnidad('550e8400-e29b-41d4-a716-446655440000')
```

## 7. Actualizar Unidad

```typescript
// PUT /api/units/[id]
async function actualizarUnidad(
  id: string,
  datos: Partial<{
    brand: string
    model: string
    year: number
    price: number
    description: string
    images: string[]
    status: 'available' | 'sold'
  }>
) {
  const token = await obtenerToken() // Tu lógica para obtener el token

  const response = await fetch(`/api/units/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(datos),
  })

  if (response.ok) {
    const unidadActualizada = await response.json()
    console.log('Unidad actualizada:', unidadActualizada)
    return unidadActualizada
  } else if (response.status === 403) {
    console.error('No tienes permiso para editar esta unidad')
  } else if (response.status === 401) {
    console.error('No autenticado')
  }
}

// Uso:
const actualizada = await actualizarUnidad(
  'id-de-la-unidad',
  {
    price: 26000,
    status: 'sold',
  }
)
```

## 8. Eliminar Unidad

```typescript
// DELETE /api/units/[id]
async function eliminarUnidad(id: string) {
  const token = await obtenerToken()

  const response = await fetch(`/api/units/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (response.ok) {
    const result = await response.json()
    console.log('Unidad eliminada:', result)
    return true
  } else if (response.status === 403) {
    console.error('No tienes permiso para eliminar esta unidad')
    return false
  } else if (response.status === 401) {
    console.error('No autenticado')
    return false
  }
}

// Uso:
const eliminada = await eliminarUnidad('id-de-la-unidad')
if (eliminada) {
  console.log('Unidad eliminada correctamente')
}
```

## 9. Flujo Completo: Crear Unidad con Imágenes

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadMultipleImages } from '@/lib/blob'

async function flujoCompletoCrearUnidad() {
  const router = useRouter()

  try {
    // 1. Obtener sesión
    const { data: { session }, error: sessionError } = 
      await supabase.auth.getSession()

    if (sessionError || !session) {
      throw new Error('Debes iniciar sesión primero')
    }

    // 2. Seleccionar imágenes
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const archivos = Array.from(target.files || [])

      if (archivos.length === 0) return

      try {
        // 3. Subir imágenes a Vercel Blob
        console.log('Subiendo imágenes...')
        const imageUrls = await uploadMultipleImages(archivos)
        console.log('URLs obtenidas:', imageUrls)

        // 4. Crear unidad en Supabase
        console.log('Guardando unidad...')
        const response = await fetch('/api/units', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            brand: 'Toyota',
            model: 'Corolla',
            year: 2023,
            price: 25000,
            description: 'Mi primer vehículo en la plataforma',
            images: imageUrls,
          }),
        })

        if (response.ok) {
          const unidad = await response.json()
          console.log('✅ Unidad creada:', unidad)
          
          // 5. Redirigir a la unidad creada
          router.push(`/app/units/${unidad.id}`)
        } else {
          throw new Error('Error al crear la unidad')
        }
      } catch (error) {
        console.error('❌ Error:', error)
        alert('Error al crear la unidad. Intenta nuevamente.')
      }
    }

    input.click()
  } catch (error) {
    console.error('Error:', error)
    alert(error instanceof Error ? error.message : 'Error desconocido')
  }
}

// Llamar función
flujoCompletoCrearUnidad()
```

## 10. Obtener Token de Supabase

```typescript
// Opción 1: Desde sesión activa
async function obtenerToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// Opción 2: Desde localStorage (para cliente)
function obtenerTokenDelNavegador() {
  const session = JSON.parse(
    localStorage.getItem('supabase.auth.token') || '{}'
  )
  return session.access_token
}

// Opción 3: Para componentes React
import { useEffect, useState } from 'react'

function MiComponente() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null)
    })
  }, [])

  return (
    <div>
      {token ? (
        <p>Estás autenticado</p>
      ) : (
        <p>Por favor inicia sesión</p>
      )}
    </div>
  )
}
```

## 11. Manejo de Errores Común

```typescript
async function crearUnidadConManejodeErrores() {
  try {
    // Tu código...
    
  } catch (error) {
    if (error instanceof Error) {
      // Error de JavaScript
      console.error('Error:', error.message)
      
      if (error.message.includes('auth')) {
        // Problema de autenticación
        console.error('Problema con autenticación')
      }
    }
  }
}

// También manejo de errores HTTP
async function llamarAPI(url: string, opciones?: RequestInit) {
  const response = await fetch(url, opciones)

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const mensaje = data.error || `Error ${response.status}`
    
    switch (response.status) {
      case 400:
        console.error('Datos inválidos:', mensaje)
        break
      case 401:
        console.error('No autenticado:', mensaje)
        // Redirigir a login
        break
      case 403:
        console.error('No autorizado:', mensaje)
        break
      case 404:
        console.error('No encontrado:', mensaje)
        break
      default:
        console.error('Error del servidor:', mensaje)
    }
    
    throw new Error(mensaje)
  }

  return data
}
```

## Variables de Entorno Requeridas

```env
# En .env.local
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

## Notas Importantes

- ✅ El cliente siempre necesita autenticarse en Supabase antes de crear unidades
- ✅ Las imágenes se suben directamente a Vercel Blob desde el navegador
- ✅ Solo las URLs se guardan en la base de datos (no los archivos)
- ✅ Las políticas RLS aseguran que solo el propietario pueda editar/eliminar
- ✅ El catálogo es público (cualquiera puede ver todas las unidades)
- ✅ Los errores 403 significan "sin autorización" (no es tu unidad)
- ✅ Los errores 401 significan "sin autenticación" (no has iniciado sesión)
