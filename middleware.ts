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
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('Middleware')

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

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 100

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

interface RateLimitInfo {
  count: number
  resetTime: number
}

// ============================================================================
// RATE LIMITING (Simple in-memory - usar Redis en producción)
// ============================================================================

const rateLimitMap = new Map<string, RateLimitInfo>()

function getRateLimitKey(request: NextRequest, userId?: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 
             request.headers.get('x-real-ip') ?? 
             'unknown'
  return userId ? `user:${userId}` : `ip:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const info = rateLimitMap.get(key)

  if (!info || now > info.resetTime) {
    // Nueva ventana
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime: now + RATE_LIMIT_WINDOW_MS }
  }

  if (info.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: info.resetTime }
  }

  info.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - info.count, resetTime: info.resetTime }
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

export async function middleware(request: NextRequest): Promise<NextResponse> {
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
    // Rate limiting para todas las rutas API
    const rateLimitKey = getRateLimitKey(request, tenant?.userId)
    const rateLimit = checkRateLimit(rateLimitKey)

    if (!rateLimit.allowed) {
      log.warn({ ...metadata }, 'Rate limit excedido')
      
      return addSecurityHeaders(
        NextResponse.json(
          { 
            success: false, 
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000)),
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

    // Crear response con headers de rate limit
    let response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS))
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)))

    // Añadir headers de tenant para uso en API routes
    response.headers.set('x-user-id', tenant.userId)
    response.headers.set('x-company-id', tenant.companyId)
    response.headers.set('x-user-role', tenant.role)

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

    // Añadir headers de tenant
    const response = NextResponse.next()
    response.headers.set('x-user-id', tenant.userId)
    response.headers.set('x-company-id', tenant.companyId)
    response.headers.set('x-user-role', tenant.role)

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
