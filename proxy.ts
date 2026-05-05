/**
 * Enterprise Middleware Global
 * - Protección de rutas API y App
 * - Validación de sesión con NextAuth
 * - Multi-tenancy con tenantId obligatorio
 * - Headers de seguridad (No-Cache habilitado)
 * - Logging de requests
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Inline logger — safe for Edge Runtime
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
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/public',
  '/catalog',
  '/api/diag',
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

/**
 * Resuelve NEXTAUTH_SECRET de forma robusta
 */
function getResolvedSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET no está configurada')
  }
  return secret
}

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
    const secret = getResolvedSecret()
    
    // Timeout de 2s: si getToken cuelga, fallar a null
    const token = await Promise.race([
      getToken({ 
        req: request,
        secret
      }),
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

function hasNextAuthCookies(request: NextRequest): boolean {
  return Array.from(request.cookies, ([name]) => name)
    .some((name) =>
      name.startsWith('next-auth.') || name.startsWith('__Secure-next-auth.')
    )
}

function clearNextAuthCookies(response: NextResponse, request?: NextRequest): NextResponse {
  const cookiesToClear = request
    ? Array.from(request.cookies, ([name]) => name)
        .filter((name) => name.startsWith('next-auth.') || name.startsWith('__Secure-next-auth.'))
    : [
        '__Secure-next-auth.session-token',
        'next-auth.session-token',
        '__Secure-next-auth.callback-url',
        'next-auth.callback-url',
        '__Secure-next-auth.csrf-token',
        'next-auth.csrf-token',
      ]

  for (const name of Array.from(new Set(cookiesToClear))) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      expires: new Date(0),
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }
  return response
}

/**
 * Añade headers de seguridad y deshabilita cache para asegurar frescura de datos
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Seguridad estándar
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Deshabilitar cache del navegador (Solución a "no se almacene cache")
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
// MIDDLEWARE PRINCIPAL
// ============================================================================

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // 1. Verificar rutas públicas
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next()
    return addSecurityHeaders(response)
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
      const response = NextResponse.json(
        { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
      return addSecurityHeaders(response)
    }

    // Inyectar headers de tenant
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    
    log.info({ ...metadata, duration: Date.now() - startTime }, 'API request autorizado')
    return addSecurityHeaders(response)
  }

  // 4. Proteger rutas de la aplicación (/app/*)
  if (pathname.startsWith('/app/') || pathname === '/app') {
    if (!tenant) {
      log.warn(metadata, 'Redirigiendo a login - sesión no válida')
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      const response = NextResponse.redirect(loginUrl)
      return addSecurityHeaders(response)
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', tenant.userId)
    requestHeaders.set('x-company-id', tenant.companyId)
    requestHeaders.set('x-user-role', tenant.role)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    return addSecurityHeaders(response)
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
