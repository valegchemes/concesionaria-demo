/**
 * Proxy (antes Middleware) — Enterprise Global Auth Proxy
 * - Protección de rutas API y App
 * - Validación de JWT con NextAuth
 * - Multi-tenancy: inyecta x-company-id, x-user-id, x-user-role
 * - Headers de seguridad y no-cache
 *
 * MIGRATION NOTE: Renombrado de middleware.ts a proxy.ts (Next.js 16 breaking change).
 * La función principal se llama 'proxy' en lugar de 'middleware'.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Inline logger — safe for Edge Runtime
const log = {
  debug: (meta: object, msg: string) => console.debug('[Proxy]', msg, meta),
  info:  (meta: object, msg: string) => console.info('[Proxy]', msg, meta),
  warn:  (meta: object, msg: string) => console.warn('[Proxy]', msg, meta),
  error: (meta: object, msg: string) => console.error('[Proxy]', msg, meta),
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/api/auth',
  '/api/webhooks',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/public',
  '/catalog',
  // /api/diag ya NO es pública — protegida por Bearer token (DIAG_SECRET_TOKEN)
]

// ============================================================================
// TIPOS ESTRUCTURADOS
// ============================================================================

interface TokenPayload {
  id?: string
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
// UTILIDADES DE SEGURIDAD Y SESIÓN
// ============================================================================

function getResolvedSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET no está configurada')
  }
  return secret
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route =>
    pathname === route ||
    pathname.startsWith(`${route}/`)
  )
}

/**
 * Valida que el callbackUrl sea del mismo origen para prevenir Open Redirect.
 */
function isSafeCallbackUrl(url: string, requestUrl: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    const base = new URL(requestUrl)
    const callback = new URL(url)
    return callback.origin === base.origin
  } catch {
    return false
  }
}

/**
 * Extrae tenantId desde el token JWT de NextAuth
 */
async function getTenantFromToken(request: NextRequest): Promise<{ userId: string; companyId: string; role: string } | null> {
  try {
    const secret = getResolvedSecret()
    
    const token = await Promise.race([
      getToken({ req: request, secret }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
    ]) as TokenPayload | null

    const userId = token?.id ?? token?.sub
    if (!userId || !token?.companyId) {
      return null
    }

    return {
      userId,
      companyId: token.companyId,
      role: token.role ?? 'SELLER',
    }
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error extrayendo token JWT')
    return null
  }
}

/**
 * Añade headers de seguridad y deshabilita cache
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('Surrogate-Control', 'no-store')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

// ============================================================================
// PROXY PRINCIPAL (antes: middleware)
// ============================================================================

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // En producción forzar HTTPS
  if (process.env.NODE_ENV === 'production') {
    const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
    if (protocol !== 'https') {
      const redirectUrl = new URL(request.url)
      redirectUrl.protocol = 'https'
      return addSecurityHeaders(NextResponse.redirect(redirectUrl, 308))
    }
  }

  // 1. Verificar rutas públicas
  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // 2. Extraer información del usuario autenticado
  const tenant = await getTenantFromToken(request)

  const metadata: RequestMetadata = {
    path: pathname,
    method: request.method,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    timestamp: new Date().toISOString(),
    userId: tenant?.userId,
    companyId: tenant?.companyId,
  }

  // 3. Proteger rutas API
  if (pathname.startsWith('/api/')) {
    if (!tenant) {
      log.warn(metadata, 'Acceso no autorizado a API')
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      )
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    log.info({ ...metadata, duration: Date.now() - startTime }, 'API request autorizado')
    return addSecurityHeaders(response)
  }

  // 4. Proteger rutas de la aplicación (/app/*)
  if (pathname.startsWith('/app/') || pathname === '/app') {
    if (!tenant) {
      log.warn(metadata, 'Redirigiendo a login - sesión no válida')
      const loginUrl = new URL('/login', request.url)
      const safePath = isSafeCallbackUrl(pathname, request.url) ? pathname : '/app'
      loginUrl.searchParams.set('callbackUrl', safePath)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)

    return addSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } })
    )
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/api/((?!auth|webhooks|diag).*)',
    '/app/:path*',
    '/app',
    '/login',
    '/register',
  ],
}
