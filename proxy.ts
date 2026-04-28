/**
 * Enterprise Middleware Global
 * - Protección de rutas API y App
 * - Validación de sesión con NextAuth
 * - Multi-tenancy con tenantId obligatorio
 * - Rate limiting básico
 * - Headers de seguridad
 * - Logging de requests
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/rate-limit-kv'

// Inline logger — safe for Edge Runtime (no pino/require)
const log = {
  debug: (meta: object, msg: string) => console.debug('[Middleware]', msg, meta),
  info:  (meta: object, msg: string) => console.info('[Middleware]', msg, meta),
  warn:  (meta: object, msg: string) => console.warn('[Middleware]', msg, meta),
  error: (meta: object, msg: string) => console.error('[Middleware]', msg, meta),
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/api/auth',
  '/api/webhooks',
  '/_next',
  '/favicon.ico',
  '/public',
  '/catalog',
]

// Rate limiting: configurado en lib/rate-limit-kv.ts (Vercel KV / Redis)
// Valores por defecto: 100 req / 60s por IP o userId

// ============================================================================
// TIPOS ESTRUCTURADOS
// ============================================================================

interface TokenPayload {
  sub?: string
  email?: string
  companyId?: string
  role?: string
  iat?: number
  exp?: number
}

interface RequestMetadata {
  path: string
  method: string
  ip: string
  userAgent: string
  userId?: string
  companyId?: string
  timestamp: string
  [key: string]: string | number | boolean | object | undefined | null
}



// ============================================================================
// RATE LIMITING — Vercel KV (Redis distribuido, funciona en serverless)
// ============================================================================

/**
 * Obtiene el identificador único para rate limiting.
 * Prioriza userId (autenticado) sobre IP, para evitar que una IP compartida
 * (ej: oficina o NAT) bloquee a múltiples usuarios legítimos.
 */
function getRateLimitIdentifier(request: NextRequest, userId?: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
             request.headers.get('x-real-ip') ??
             'unknown'
  return userId ? `user:${userId}` : `ip:${ip}`
}

// ============================================================================
// UTILIDADES DE SEGURIDAD
// ============================================================================

/**
 * Verifica si una ruta es pública
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || 
    pathname.startsWith(`${route}/`)
  )
}

/**
 * Extrae tenantId desde el token JWT de NextAuth
 */
async function getTenantFromToken(request: NextRequest): Promise<{ userId: string; companyId: string; role: string } | null> {
  try {
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    }) as TokenPayload | null

    if (!token?.sub || !token.companyId) {
      return null
    }

    return {
      userId: token.sub,
      companyId: token.companyId,
      role: token.role ?? 'SELLER',
    }
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error extrayendo token JWT')
    return null
  }
}

/**
 * Añade headers de seguridad estándar
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevenir clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevenir MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Política de referencia
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Política de permisos
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // CSP básico
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self'; connect-src 'self' https:;"
  )

  return response
}

// ============================================================================
// MIDDLEWARE PRINCIPAL
// ============================================================================

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // Logging de request
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 
                   request.headers.get('x-real-ip') ?? 
                   'unknown'
  
  const metadata: RequestMetadata = {
    path: pathname,
    method: request.method,
    ip: clientIp,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    timestamp: new Date().toISOString(),
  }

  log.debug(metadata, 'Request recibido')

  // 1. Verificar rutas públicas (no requieren auth)
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next()
    return addSecurityHeaders(response)
  }

  // 2. Extraer información del usuario autenticado
  const tenant = await getTenantFromToken(request)

  if (tenant) {
    metadata.userId = tenant.userId
    metadata.companyId = tenant.companyId
  }

  // 3. Proteger rutas API
  if (pathname.startsWith('/api/')) {
    // Rate limiting distribuido con Vercel KV (Redis)
    // Funciona correctamente en serverless: cada instancia lee/escribe el mismo contador
    const rateLimitIdentifier = getRateLimitIdentifier(request, tenant?.userId)
    const rateLimit = await checkRateLimit(rateLimitIdentifier)

    if (!rateLimit.success) {
      log.warn({ ...metadata, rateLimitIdentifier }, 'Rate limit excedido (KV)')

      return addSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(rateLimit.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(rateLimit.reset / 1000)),
            },
          }
        )
      )
    }

    // Verificar autenticación para rutas API protegidas
    if (!tenant) {
      log.warn({ ...metadata }, 'Acceso no autorizado a API')
      
      return addSecurityHeaders(
        NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        )
      )
    }

    // Crear request headers con la info del tenant para las API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)

    // Crear response con headers de rate limit y los request headers inyectados
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
    response.headers.set('X-RateLimit-Limit', String(rateLimit.limit))
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.reset / 1000)))

    // Logging de API request autorizado
    log.info({ ...metadata, duration: Date.now() - startTime }, 'API request autorizado')

    return addSecurityHeaders(response)
  }

  // 4. Proteger rutas de la aplicación (/app/*)
  if (pathname.startsWith('/app/') || pathname === '/app') {
    if (!tenant) {
      log.warn({ ...metadata }, 'Redirigiendo a login - sesión no válida')
      
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      
      return NextResponse.redirect(loginUrl)
    }

    // Añadir headers de tenant al request para Server Components
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)
    requestHeaders.set('x-pathname', pathname)

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    return addSecurityHeaders(response)
  }

  // 5. Rutas restantes
  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

// ============================================================================
// CONFIGURACIÓN DEL MATCHER
// ============================================================================

export const config = {
  matcher: [
    // Rutas de API
    '/api/:path*',
    // Rutas de aplicación
    '/app/:path*',
    '/app',
    // Excluir archivos estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


