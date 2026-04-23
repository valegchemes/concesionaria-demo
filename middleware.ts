import { withAuth } from 'next-auth/middleware'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware principal: aplica headers de seguridad y protege rutas.
 * Las rutas /app/* requieren sesión activa → redirige a /login si no hay.
 */
export default withAuth(
  function middleware(request: NextRequest) {
    const response = NextResponse.next()

    // ============================================================================
    // Security Headers
    // ============================================================================

    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    )

    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
    }

    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:;"
    )

    return response
  },
  {
    callbacks: {
      // Permite la request solo si hay token (sesión válida)
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    // Proteger todas las rutas de la app
    '/app/:path*',
    // Excluir rutas públicas, archivos estáticos y API
    '/((?!login|register|public|api|_next/static|_next/image|favicon.ico).*)',
  ],
}
