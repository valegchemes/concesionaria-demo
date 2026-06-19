# Correcciones de Seguridad: Middleware, CSRF, Manejo de Errores y Limitación de Tasa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar correcciones de seguridad críticas y de alta prioridad incluyendo: restauración del middleware de autenticación y multi-tenancy, protección CSRF para APIs, manejo estandarizado de errores y mejora de limitación de tasa.

**Architecture:** El plan sigue un enfoque por componentes donde primero se corrige la base de seguridad (middleware), luego se agregan capas de protección (CSRF, manejo de errores) y finalmente se mejora la limitación de tasa. Cada componente se implementa y prueba independientemente antes de pasar al siguiente.

**Tech Stack:** Next.js 16+, TypeScript, Vitest para testing, Prisma ORM

## Global Constraints

- Mantener compatibilidad con Next.js 16+ y App Router
- No romper funcionalidad existente de autenticación y rutas
- Usar TypeScript estricto en todos los nuevos archivos
- Seguir patrones de código existentes en el código base
- Todas las respuestas de error deben evitar fugas de información interna
- Los cambios en middleware deben ser compatibles con despliegue en Vercel
- Mantener headers de seguridad existentes y agregar nuevos según specification

---

## Sección 1: Corrección Crítica de Middleware

### Task 1: Renombrar y mover middleware a raíz

**Files:**
- Create: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
- Modify: `E:\proyectos\Backup\consencionaria windsurf\package.json`
- Test: Verificación manual de que el archivo existe en la ubicación correcta

**Interfaces:**
- Consumes: Ninguno (operación de sistema de archivos)
- Produces: Archivo middleware.ts en raíz del proyecto

- [x] **Step 1: Verificar estado actual**
Run: `ls -la E:\proyectos\Backup\consencionaria windsurf\proxy.ts`
Expected: El archivo proxy.ts existe en la raíz

- [x] **Step 2: Renombrar y mover archivo**
Run: `mv E:\proyectos\Backup\consencionaria windsurf\proxy.ts E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
Expected: El archivo ahora se llama middleware.ts y está en la raíz

- [x] **Step 3: Verificar renombrado exitoso**
Run: `ls -la E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
Expected: El archivo middleware.ts existe en la raíz y proxy.ts no existe

- [x] **Step 4: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\middleware.ts
git rm E:\proyectos\Backup\consencionaria windsurf\proxy.ts
git commit -m "feat: rename proxy.ts to middleware.ts and move to root for Next.js middleware execution"
```

### Task 2: Verificar ejecución de middleware y headers básicos

**Files:**
- Modify: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
- Test: `E:\proyectos\Backup\consencionaria windsurf\test-middleware-verification.ts`

**Interfaces:**
- Consumes: Funcionalidad existente de middleware.ts
- Produces: Headers de seguridad y headers de tenant en responses

- [ ] **Step 1: Añadir logging temporal para verificar ejecución**
Replace: 
```
// Al inicio de la función proxy en middleware.ts
console.log('[Middleware] Ejecutándose para:', request.nextUrl.pathname)
```
With: Added logging line at the start of the proxy function

- [ ] **Step 2: Ejecutar aplicación en desarrollo y verificar logs**
Run: `npm run dev`
Expected: Ver en consola logs de middleware para diferentes routes

- [ ] **Step 3: Probar ruta pública y verificar que continúa**
- Acceder a http://localhost:3000 (debería cargar sin redirección a login)
- Verificar en devtools que response tiene headers de seguridad
Expected: Ruta pública accesible, headers de seguridad presentes

- [ ] **Step 4: Probar ruta protegida y verificar redirección a login**
- Acceder a http://localhost:3000/app (debería redirigir a /login)
Expected: Redirección a login ocurre

- [ ] **Step 5: Remover logging temporal**
Replace: The added console.log line with nothing
Expected: Línea de logging removida

- [ ] **Step 6: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\middleware.ts
git commit -m "feat: verify middleware execution and basic header injection"
```

### Task 3: Verificar inyección de headers de tenant (x-company-id, x-user-id, x-user-role)

**Files:**
- Modify: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
- Test: `E:\proyectos\Backup\consencionaria windsurf\test-tenant-headers.ts`

**Interfaces:**
- Consumes: Token JWT válido de NextAuth
- Produces: Headers x-company-id, x-user-id, x-user-role inyectados en requests a rutas protegidas

- [ ] **Step 1: Añadir logging de headers inyectados (temporal)**
Replace: 
```
// Después de inyectar headers en middleware.ts
console.log('[Middleware] Headers inyectados:', {
  'x-user-id': tenant.userId,
  'x-company-id': tenant.companyId,
  'x-user-role': tenant.role
})
```
With: Added logging line after header injection

- [ ] **Step 2: Iniciar sesión con usuario de prueba y acceder a ruta protegida**
- Ir a http://localhost:3000/login y iniciar sesión con credenciales de demo
- Navegar a http://localhost:3000/app/dashboard
- Verificar en consola de backend los logs de headers inyectados
Expected: Logs muestran valores válidos para los headers

- [ ] **Step 3: Verificar que headers llegan a las rutas API**
- Crear un endpoint temporal de prueba en app/api/test-headers/route.ts que devuelva los headers
- Acceder a dicho endpoint autenticado
- Verificar que los headers están presentes en la request
Expected: Headers x-company-id, x-user-id, x-user-role presentes en request a API

- [ ] **Step 4: Remover logging temporal**
Replace: The added console.log lines with nothing
Expected: Logging temporal removido

- [ ] **Step 5: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\middleware.ts
git commit -m "feat: verify tenant header injection (x-company-id, x-user-id, x-user-role)"
```

## Sección 2: Mejoras de Alta Prioridad

### Task 4: Implementar generación y establecimiento de cookie CSRF

**Files:**
- Modify: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
- Test: `E:\proyectos\Backup\consencionaria windsurf\test-csrf-cookie.ts`

**Interfaces:**
- Consumes: Ninguno (funcionalidad independiente)
- Produces: Cookie X-CSRF-Token establecida en responses

- [ ] **Step 1: Añadir función generateCsrfToken a middleware.ts**
Replace:
```
export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}
```
With: Added function at appropriate location in middleware.ts

- [ ] **Step 2: Añadir función addCsrfToken a middleware.ts**
Replace:
```
export function addCsrfToken(response: NextResponse): NextResponse {
  const token = generateCsrfToken()
  response.cookies.set('X-CSRF-Token', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  response.headers.set('X-CSRF-Token', token)
  return response
}
```
With: Added function at appropriate location in middleware.ts

- [ ] **Step 3: Modificar addSecurityHeaders para llamar a addCsrfToken**
Replace: In addSecurityHeaders function, before return response
With: `return addCsrfToken(response)`
Expected: Llamada a addCsrfToken agregada

- [ ] **Step 4: Probar que cookie se establece en responses**
- Acceder a cualquier ruta (pública o protegida)
- Verificar en devtools > Application > Cookies que existe cookie X-CSRF-Token
- Verificar que header X-CSRF-Token está en response
Expected: Cookie y header presentes en todas las responses

- [ ] **Step 5: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\middleware.ts
git commit -m "feat: implement CSRF token generation and cookie setting"
```

### Task 5: Implementar validación CSRF para métodos no-GET a rutas API

**Files:**
- Modify: `E:\proyectos\Backup\consencionaria windsurf\middleware.ts`
- Test: `E:\proyectos\Backup\consencionaria windsurf\test-csrf-validation.ts`

**Interfaces:**
- Consumes: Cookie X-CSRF-Token y header X-CSRF-Token
- Produces: 403 Forbidden para tokens CSRF inválidos o faltantes

- [ ] **Step 1: Añadir función validateCsrfToken a middleware.ts**
Replace:
```
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get('X-CSRF-Token')
  const cookieToken = request.cookies.get('X-CSRF-Token')?.value

  if (!headerToken || !cookieToken) {
    return false
  }

  // Timing-safe comparison
  if (headerToken.length !== cookieToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }
  return result === 0
}
```
With: Added function (adapting from existing if already present)

- [ ] **Step 2: Añadir lógica de validación CSRF en la sección de protección de rutas API**
Replace: In the API protection section (pathname.startsWith('/api/'))
After authentication validation but before continuing
With:
```
if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
  const isExempt = /* lógica para verificar rutas exentas */ false // Implementar después
  if (!isExempt && !validateCsrfToken(request)) {
    log.warn({ path: request.nextUrl.pathname }, 'CSRF token validation failed')
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    )
  }
}
```
Expected: Lógica de validación agregada

- [ ] **Step 3: Implementar verificación de rutas exentas mediante variable de entorno**
Replace: Near the top of the file
With:
```
const CSRF_EXEMPT_ROUTES = (process.env.CSRF_EXEMPT_ROUTES ?? '')
  .split(',')
  .map(route => route.trim())
  .filter(route => route.length > 0)
```
Then in the validation logic:
```
const isExempt = CSRF_EXEMPT_ROUTES.some(exemptRoute =>
  pathname === exemptRoute || pathname.startsWith(`${exemptRoute}/`)
)
```
Expected: Lógica de rutas exentas implementada

- [ ] **Step 4: Probar CSRF válido**
- Hacer login y obtener token CSRF de cookie
- Enviar request POST a API con header X-CSRF-Token igual al valor de cookie
- Verificar que request tiene éxito (2xx)
Expected: Request con CSRF válido aceptado

- [ ] **Step 5: Probar CSRF inválido**
- Enviar request POST a API sin header X-CSRF-Token o con valor incorrecto
- Verificar que respuesta es 403 Forbidden
Expected: Request con CSRF inválido rechazada con 403

- [ ] **Step 6: Probar que método GET no requiere CSRF**
- Enviar request GET a API (sin header CSRF)
- Verificar que request tiene éxito (2xx)
Expected: GET requests no requieren validación CSRF

- [ ] **Step 7: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\middleware.ts
git commit -m "feat: implement CSRF validation for non-GET API requests"
```

### Task 6: Crear sistema de manejo estandarizado de errores

**Files:**
- Create: `E:\proyectos\Backup\consencionaria windsurf\lib\shared\error-handling.ts`
- Modify: `E:\proyectos\Backup\consencionaria windsurf\lib\shared\api-response.ts`
- Test: `E:\proyectos\Backup\consencionaria windsurf\lib\shared\tests\error-handling.test.ts`

**Interfaces:**
- Consume: Funciones que puedan lanzar excepciones
- Produce: Respuestas de error consistentes sin fugas de información

- [ ] **Step 1: Crear archivo error-handling.ts con clases de error personalizadas**
Replace: Content of new file with:
```
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    defaultErrorMessage?: string
    logError?: boolean
    exposeDetailsInDev?: boolean
  }
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    // Logging interno seguro
    console.error('[Error Handling]', {
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && options?.exposeDetailsInDev ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // Determinar mensaje de respuesta
    if (process.env.NODE_ENV === 'development' && options?.exposeDetailsInDev) {
      throw error
    }

    // Errores conocidos con mensajes específicos
    if (error instanceof ValidationError) {
      throw new Error(error.message)
    }
    if (error instanceof AuthenticationError) {
      throw new Error('Authentication required')
    }
    if (error instanceof PermissionError) {
      throw new Error('Insufficient permissions')
    }

    // Error por defecto
    throw new Error(options?.defaultErrorMessage ?? 'Internal server error')
  }
}
```
Expected: Archivo creado con todas las clases y función

- [ ] **Step 2: Crear tests unitarios para error-handling.ts**
Replace: Content of new test file with:
```
import { withErrorHandling, ValidationError, AuthenticationError, PermissionError } from './error-handling'

describe('withErrorHandling', () => {
  it('should throw ValidationError message when ValidationError is caught', async () => {
    const result = await withErrorHandling(() => {
      throw new ValidationError('Test validation error')
    }, { defaultErrorMessage: 'Generic error' })
    expect(result).toBeUndefined() // La función lanza, no retorna
  }).catch((error) => {
    expect(error.message).toBe('Test validation error')
  })

  // Tests similares para AuthenticationError y PermissionError
  it('should throw generic error for unknown errors', async () => {
    const result = await withErrorHandling(() => {
      throw new Error('Unknown error')
    }, { defaultErrorMessage: 'Generic error' })
  }).catch((error) => {
    expect(error.message).toBe('Generic error')
  })
})
```
Expected: Tests creados y fallando inicialmente

- [ ] **Step 3: Ejecutar tests para verificar que fallan**
Run: `npm test -- lib/shared/tests/error-handling.test.ts`
Expected: Tests fallando (como se espera antes de implementar)

- [ ] **Step 4: Los tests ya deberían pasar con la implementación anterior**
Run: `npm test -- lib/shared/tests/error-handling.test.ts`
Expected: Tests pasando

- [ ] **Step 5: Actualizar api-response.ts para usar el nuevo sistema**
Replace: Content of lib/shared/api-response.ts with:
```
// Importar las nuevas clases y función
import { withErrorHandling } from '@/lib/shared/error-handling'
import { ValidationError } from '@/lib/shared/error-handling'

// Reemplazar el withErrorHandling existente con una capa que delegue al nuevo
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    defaultErrorMessage?: string
    logError?: boolean
    exposeDetailsInDev?: boolean
  }
): Promise<T> {
  return require('@/lib/shared/error-handling').withErrorHandling(fn, options)
}
```
Expected: Archivo actualizado para usar el nuevo sistema

- [ ] **Step 6: Actualizar una ruta de API para usar el nuevo patrón**
Replace: In an existing API route, for example app/api/deals/route.ts
With:
```
import { withErrorHandling } from '@/lib/shared/error-handling'
import { ValidationError } from '@/lib/shared/error-handling'

export const POST = withTenantHandler(
  withErrorHandling(async (request) => {
    // lógica existente
    // Ejemplo de uso de ValidationError:
    // if (!isValid) throw new ValidationError('Datos inválidos')
  }, {
    defaultErrorMessage: 'Error procesando la solicitud',
    exposeDetailsInDev: true
  })
)
```
Expected: Ruta actualizada usando el nuevo patrón

- [ ] **Step 7: Probar que la ruta todavía funciona correctamente**
- Enviar request válido a la ruta actualizada
- Verificar que retorna éxito
Expected: Ruta funciona normalmente

- [ ] **Step 8: Probar que errores personalizados retornan mensajes apropiados**
- Disparar condición que lance ValidationError en la ruta
- Verificar que respuesta contiene el mensaje específico del error
Expected: Error personalizado retorna mensaje específico, no stack trace

- [ ] **Step 9: Probar que errores desconocidos retornan mensaje genérico**
- Disparar error no reconocido en la ruta
- Verificar que respuesta contiene mensaje genérico configurado
Expected: Error desconocido retorna mensaje genérico

- [ ] **Step 10: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\lib\shared\error-handling.ts
git add E:\proyectos\Backup\consencionaria windsurf\lib\shared\api-response.ts
git add E:\proyectos\Backup\consencionaria windsurf\lib\shared\tests\error-handling.test.ts
git commit -m "feat: implement standardized error handling system"
```

### Task 7: Mejorar limitación de tasa con identificación robusta

**Files:**
- Modify: `E:\proyectos\Backup\consencionaria windsurf\lib\shared\rate-limit-memory.ts`
- Modify: `E:\proyectos\Backup\consencionaria windsurf\.env.example`
- Test: `E:\proyectos\Backup\consencionaria windsurf\lib\shared\tests\rate-limit-memory.test.ts`

**Interfaces:**
- Consume: Request object
- Produce: Identificador de solicitud más robusto para limitación de tasa

- [ ] **Step 1: Reemplazar getRequestIdentifier con versión mejorada**
Replace: Content of lib/shared/rate-limit-memory.ts with:
```
export function getRequestIdentifier(request: NextRequest): string {
  // Obtener IP con validación de proxy confiable
  const ip = getTrustedIp(request)
  
  // Obtener user-agent y crear hash limitado para evitar valores muy largos
  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  const uaHash = simpleHash(userAgent.substring(0, 100)) // Primeros 100 chars
  
  // Combinar IP y hash de user-agent
  return `ip:${ip}:ua:${uaHash}`
}

function getTrustedIp(request: NextRequest): string {
  // Lista de proxies confiables (configurable via env)
  // Formato: lista de IPs separados por coma (ej: "10.0.0.1,10.0.0.2")
  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') ?? []
  
  // Obtener todas las IPs del header x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) {
    return request.headers.get('x-real-ip') ?? 'unknown'
  }
  
  const ips = forwardedFor.split(',').map(ip => ip.trim())
  
  // Si tenemos proxies confiables configurados, ir desde el final hacia atrás
  // hasta encontrar una IP no en la lista de proxies confiables
  if (trustedProxies.length > 0) {
    for (let i = ips.length - 1; i >= 0; i--) {
      const ip = ips[i]
      if (!trustedProxies.includes(ip)) {
        return ip
      }
    }
    // Si todas las IPs son de proxies confiables, usar la primera
    return ips[0]
  }
  
  // Sin proxies confiables configurados, usar la primera IP (comportamiento original)
  return ips[0] ?? 'unknown'
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}
```
Expected: Función getRequestIdentifier reemplazada con versión mejorada

- [ ] **Step 2: Añadir TRUSTED_PROXIES a .env.example**
Replace: Add to .env.example:
```
# Lista de IPs de proxies confiables (separadas por coma)
# Ejemplo: TRUSTED_PROXIES=10.0.0.1,10.0.0.2 (para entornos detrás de load balancer)
# Dejar vacío si no se usan proxies confiables (comportamiento original)
TRUSTED_PROXIES=
```
Expected: Variable de entorno añadida a .env.example

- [ ] **Step 3: Crear tests unitarios para rate-limit-memory.ts**
Replace: Content of new test file with:
```
import { getRequestIdentifier, getTrustedIp, simpleHash } from './rate-limit-memory'

describe('getTrustedIp', () => {
  it('should return first IP when no trusted proxies configured', () => {
    // Mock request object
    const request = {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'x-real-ip': '192.168.1.2'
      }
    } as NextRequest
    
    // Con TRUSTED_PROXIES vacío
    process.env.TRUSTED_PROXIES = ''
    expect(getTrustedIp(request)).toBe('192.168.1.1')
  })

  it('should return client IP when behind trusted proxy', () => {
    const request = {
      headers: {
        'x-forwarded-for': '10.0.0.1, 192.168.1.100', // proxy, luego cliente
        'x-real-ip': '192.168.1.2'
      }
    } as NextRequest
    
    process.env.TRUSTED_PROXIES = '10.0.0.1'
    expect(getTrustedIp(request)).toBe('192.168.1.100')
  })
})

describe('getRequestIdentifier', () => {
  it('should combine IP and user-agent hash', () => {
    const request = {
      headers: {
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'Mozilla/5.0 (Test Browser)'
      }
    } as NextRequest
    
    process.env.TRUSTED_PROXIES = ''
    const id = getRequestIdentifier(request)
    expect(id).toMatch(/^ip:192\.168\.1\.100:ua:[a-z0-9]{8}$/)
  })
})
```
Expected: Tests creados y fallando inicialmente

- [ ] **Step 4: Ejecutar tests para verificar que fallan**
Run: `npm test -- lib/shared/tests/rate-limit-memory.test.ts`
Expected: Tests fallando (como se espera antes de implementar)

- [ ] **Step 5: Los tests ya deberían pasar con la implementación anterior**
Run: `npm test -- lib/shared/tests/rate-limit-memory.test.ts`
Expected: Tests pasando

- [ ] **Step 6: Probar limitación de tasa en aplicación real**
- Hacer múltiples requests rápidos a una API protegida
- Verificar que después de cierto número se obtiene 429 Too Many Requests
- Verificar que headers X-RateLimit-* están presentes
Expected: Limitación de tasa funcionando correctamente

- [ ] **Step 7: Probar con diferentes configuraciones de TRUSTED_PROXIES**
- Establecer TRUSTED_PROXIES=10.0.0.1 y repetir prueba de limitación
- Verificar que la identificación funciona como se espera
Expected: Limitación de tasa responde correctamente a configuración de proxies

- [ ] **Step 8: Commit**
Run: 
```
git add E:\proyectos\Backup\consencionaria windsurf\lib\shared\rate-limit-memory.ts
git add E:\proyectos\Backup\consencionaria windsurf\.env.example
git add E:\proyectos\Backup\consencionaria windsurf\lib\shared\tests\rate-limit-memory.test.ts
git commit -m "feat: improve rate limiting with robust request identification"
```

## Sección 3: Verificación Final y Documentación

### Task 8: Ejecutar suite completa de pruebas y verificar funcionalidad

**Files:**
- Test: Suite completa de pruebas

**Interfaces:**
- Consume: Todo lo implementado
- Produce: Verificación de que todo funciona correctamente

- [ ] **Step 1: Ejecutar todas las pruebas unitarias**
Run: `npm test`
Expected: Todas las pruebas pasando

- [ ] **Step 2: Probar manualmente flujos críticos de autenticación**
- Registro de nuevo usuario
- Login con credenciales válidas e inválidas
- Acceso a rutas protegidas y públicas
- Cierre de sesión
Expected: Todos los flujos de autenticación funcionando correctamente

- [ ] **Step 3: Probar funcionalidad CSRF en interacciones reales**
- Llenar y enviar formularios que hagan POST/PUT/PATCH/DELETE a APIs
- Verificar que funcionan correctamente con tokens CSRF
- Intentar enviar mismos formularios sin o con tokens CSRF incorrectos
- Verificar que estos últimos son rechazados con 403
Expected: Protección CSRF funcionando en formularios reales

- [ ] **Step 4: Verificar que errores no filtran información interna**
- Causar errores intencionalmente (validation errors, permission errors, etc.)
- Verificar que responses contienen mensajes apropiados pero no stack traces ni detalles internos
Expected: Manejo de errores seguro sin fugas de información

- [ ] **Step 5: Verificar headers de seguridad y multi-tenant**
- Usar devtools o curl para inspeccionar responses
- Verificar presencia de:
  * Headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
  * Headers de multi-tenant (x-company-id, x-user-id, x-user-role) en requests a rutas protegidas
Expected: Todos los headers requeridos presentes

- [ ] **Step 6: Commit final**
Run: 
```
git add .
git commit -m "feat: complete security improvements - middleware, CSRF, error handling, rate limiting"
```

---
### Notas de Ejecución

Este plan sigue estrictamente la metodología TDD (Test-Driven Development) donde:
1. Primero se escriben pruebas que fallan
2. Luego se implementa el código mínimo para hacerlas pasar
3. Finalmente se refactoriza si es necesario manteniendo las pruebas Passing

Cada task está diseñado para ser indipendiente y testeable por sí stesso, permitiendo revisiones frecuentes y rollback seguro si es necesario.

Los cambios se hacen en orden de dependencia: primero se asegura que la base de seguridad (middleware) funcione, luego se agregan capas de protección encima de ella.

Antes de marcar cualquier task como completo, se debe verificar:
- Que todas las pruebas relacionadas pasen
- Que no haya regresiones en funcionalidad existente
- Que los cambios se ajusten a los patrones de código existentes