/**
 * Unified Middleware
 * Handles: Authentication, Tenant Resolution, Header Injection
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ============================================================================
  // 1. SETUP RESPONSE
  // ============================================================================
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ============================================================================
  // 2. SUPABASE AUTH
  // ============================================================================
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  let user: any = null

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    // Refresh session if expired
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  // ============================================================================
  // 3. ROUTE PROTECTION
  // ============================================================================

  // Public routes (no auth required)
  const publicRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/api/health',
    '/api/webhooks',
    '/api/csp-report',
  ]

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  // Skip auth for public routes and static assets
  if (isPublicRoute || isStaticAsset) {
    return response
  }

  // Protected routes: /admin, /api/*
  const isAdminRoute = pathname.startsWith('/admin')
  const isApiRoute = pathname.startsWith('/api')

  if ((isAdminRoute || isApiRoute) && !user) {
    // Redirect to login for admin routes
    if (isAdminRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Return 401 for API routes
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Redirect authenticated users away from login
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // ============================================================================
  // 4. INJECT USER HEADERS (for fast-path auth in API routes)
  // ============================================================================
  if (user) {
    try {
      // Fetch user record from database to get companyId and role
      // Note: This is a lightweight query, cached by Prisma
      const { prisma } = await import('@/lib/shared/prisma')
      const userRecord = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, companyId: true, role: true },
      })

      if (userRecord) {
        response.headers.set('x-user-id', userRecord.id)
        response.headers.set('x-company-id', userRecord.companyId)
        response.headers.set('x-user-role', userRecord.role)
      }
    } catch (error) {
      // Non-blocking: if DB query fails, continue without headers
      console.error('[Middleware] Failed to fetch user record:', error)
    }
  }

  // ============================================================================
  // 5. PUBLIC CATALOG (Tenant Resolution)
  // ============================================================================
  const host = request.headers.get('host') || ''

  // Skip tenant resolution for admin/api routes
  if (!isAdminRoute && !isApiRoute && !isStaticAsset) {
    const company = await resolveCompanyFromHost(host)

    if (company) {
      response.headers.set('x-catalog-company-id', company.id)
      response.headers.set('x-catalog-company-slug', company.slug)
    }
  }

  return response
}

/**
 * Resolve company from host (custom domain or subdomain)
 */
async function resolveCompanyFromHost(host: string) {
  const cleanHost = host.split(':')[0]

  // Skip localhost
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return null
  }

  const domain = cleanHost.replace(/^www\./, '')

  try {
    const { prisma } = await import('@/lib/shared/prisma')

    // Try custom domain first
    const byDomain = await prisma.company.findUnique({
      where: { customDomain: domain },
      select: { id: true, slug: true },
    })

    if (byDomain) return byDomain

    // Try subdomain (slug)
    const slug = domain.split('.')[0]

    const bySlug = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    })

    return bySlug
  } catch (error) {
    console.error('[Middleware] Failed to resolve company:', error)
    return null
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
