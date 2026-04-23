import { withAuth } from 'next-auth/middleware'
import { NextRequest, NextResponse } from 'next/server'

// Simple console logger for Edge Runtime (pino doesn't work in Edge)
const log = {
  debug: (...args: any[]) => console.log('[Middleware]', ...args),
  info: (...args: any[]) => console.log('[Middleware]', ...args),
  warn: (...args: any[]) => console.warn('[Middleware]', ...args),
  error: (...args: any[]) => console.error('[Middleware]', ...args),
}

/**
 * Main middleware - runs for all requests
 * Applies security headers and logging
 */
export const middleware = (request: NextRequest) => {
  const response = NextResponse.next()

  // ============================================================================
  // Security Headers
  // ============================================================================
  
  // Prevent content type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY')
  
  // XSS Protection (legacy, but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Force HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
  )
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  )

  // ============================================================================
  // Request Logging
  // ============================================================================
  
  if (request.nextUrl.pathname.startsWith('/api')) {
    const method = request.method
    const path = request.nextUrl.pathname
    
    log.debug(
      {
        method,
        path,
        headers: {
          'user-agent': request.headers.get('user-agent'),
          'x-forwarded-for': request.headers.get('x-forwarded-for'),
        },
      },
      `API request: ${method} ${path}`
    )
  }

  // ============================================================================
  // CORS Handling (for API routes)
  // ============================================================================
  
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  return response
}

/**
 * Protected routes middleware - requires authentication
 */
export const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
})

// Apply middleware to all paths
export const config = {
  matcher: [
    // Protected routes
    '/app/:path*',
    // API routes (for logging and headers)
    '/api/:path*',
    // Exclude public paths
    '/((?!login|register|public|_next/static|_next/image|favicon.ico).*)',
  ],
}

