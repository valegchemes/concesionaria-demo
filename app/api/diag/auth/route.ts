/**
 * API de diagnóstico avanzado para auth/sesión
 * GET /api/diag/auth — Debug NextAuth y cookies
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { getToken } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Diagnostic endpoint — allowed for debug/development
  // if (process.env.NODE_ENV === 'production' && secret !== process.env.NEXTAUTH_SECRET?.slice(0, 8)) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      HAS_NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      SECRET_LENGTH: process.env.NEXTAUTH_SECRET?.length ?? 0,
    },
    cookies: {
      all: Array.from(request.cookies).map(([name, cookieValue]) => ({
        name,
        length: cookieValue.value?.length ?? 0,
        value: (cookieValue.value?.length ?? 0) > 50 ? (cookieValue.value?.substring(0, 50) ?? '') + '...' : cookieValue.value ?? '',
      })),
      nextAuthCookies: Array.from(request.cookies)
        .filter(([name]) => name.startsWith('next-auth') || name.startsWith('__Secure-next-auth'))
        .map(([name, cookieValue]) => ({ name, length: cookieValue.value?.length ?? 0 })),
    },
    session: {
      status: 'pending',
      data: null,
      error: null,
    },
    token: {
      status: 'pending',
      data: null,
      error: null,
    },
  } as any

  // 1. Try getServerSession (requires request context)
  try {
    const start = Date.now()
    const session = await Promise.race([
      getServerSession(authOptions),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000)
      })
    ])
    
    if (session) {
      results.session.status = 'SUCCESS'
      results.session.data = {
        userId: (session.user as any)?.id,
        email: (session.user as any)?.email,
        companyId: (session.user as any)?.companyId,
        role: (session.user as any)?.role,
        duration: Date.now() - start,
      }
    } else {
      results.session.status = 'NO_SESSION'
      results.session.duration = Date.now() - start
    }
  } catch (error) {
    results.session.status = 'ERROR'
    results.session.error = error instanceof Error ? error.message : String(error)
  }

  // 2. Try getToken (works in middleware + route handlers)
  try {
    const start = Date.now()
    const token = await Promise.race([
      getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000)
      })
    ])

    if (token) {
      results.token.status = 'SUCCESS'
      results.token.data = {
        id: token.id,
        email: token.email,
        companyId: token.companyId,
        role: token.role,
        iat: token.iat,
        exp: token.exp,
        duration: Date.now() - start,
      }
    } else {
      results.token.status = 'NO_TOKEN'
      results.token.duration = Date.now() - start
    }
  } catch (error) {
    results.token.status = 'ERROR'
    results.token.error = error instanceof Error ? error.message : String(error)
  }

  // 3. Check for stale/broken cookies (common issue)
  const cookieIssues = []
  for (const [name, cookieValue] of request.cookies) {
    const valueLength = cookieValue.value?.length ?? 0
    if ((name.startsWith('next-auth') || name.startsWith('__Secure-next-auth')) && valueLength === 0) {
      cookieIssues.push(`Empty cookie: ${name}`)
    }
    if ((name.startsWith('next-auth') || name.startsWith('__Secure-next-auth')) && valueLength > 4096) {
      cookieIssues.push(`Oversized cookie: ${name} (${valueLength} bytes > 4KB limit)`)
    }
  }

  results.issues = cookieIssues.length > 0 ? cookieIssues : ['None detected']

  // 4. Recommendations
  const recommendations = []
  
  if (!process.env.NEXTAUTH_SECRET) {
    recommendations.push('⚠️ NEXTAUTH_SECRET not set — this will cause authentication to fail in production')
  }
  
  if (!process.env.NEXTAUTH_URL) {
    recommendations.push('⚠️ NEXTAUTH_URL not set — this may cause OAuth/callback issues')
  }

  if (results.session.status === 'NO_SESSION' && results.token.status === 'NO_TOKEN') {
    recommendations.push('❌ No valid session AND no valid token — user is NOT authenticated')
    recommendations.push('→ Check if cookies are being set correctly after login')
    recommendations.push('→ Check browser DevTools → Application → Cookies for next-auth.* cookies')
    recommendations.push('→ Try clearing site data (F12 → Application → Clear site data) and logging in again')
  }

  if (results.session.status === 'NO_SESSION' && results.token.status === 'SUCCESS') {
    recommendations.push('⚠️ Token exists but getServerSession() returns null')
    recommendations.push('→ This can happen if session strategy is not properly configured')
    recommendations.push('→ Verify NextAuth session strategy is set to "jwt" in auth-options.ts')
  }

  if (cookieIssues.length > 0) {
    recommendations.push('⚠️ Cookie issues detected:')
    cookieIssues.forEach((issue) => recommendations.push(`  → ${issue}`))
  }

  results.recommendations = recommendations

  return NextResponse.json(results)
}
