/**
 * API para limpiar cookies de NextAuth (utility endpoint)
 * POST /api/diag/clear-auth — Force clear all next-auth.* cookies
 *
 * Usado para troubleshooting cuando el navegador tiene cookies rotas/stale
 * que no se limpian normalmente.
 *
 * SEGURIDAD: Solo POST (no GET, para evitar CSRF cross-site). Requiere
 * Bearer token comparado en tiempo constante y `Sec-Fetch-Site` safe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/shared/logger'
import { timingSafeStringEqual } from '@/lib/shared/timing-safe-equal'

const log = createLogger('API:ClearAuth')

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // 1. Verificar Sec-Fetch-Site (anti CSRF cross-site). Permitir same-origin,
  //    none (curl/Postman) y same-site. Bloquear cross-site.
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Protección con Bearer token — requiere DIAG_SECRET_TOKEN.
  //    Comparación constant-time para evitar timing attacks.
  const authHeader = request.headers.get('authorization')
  const diagToken = process.env.DIAG_SECRET_TOKEN

  if (!diagToken || !authHeader || !timingSafeStringEqual(authHeader, `Bearer ${diagToken}`)) {
    log.warn({ authHeader: authHeader?.slice(0, 20) }, 'Intento no autorizado a clear-auth')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({
    message: 'Cleared all next-auth cookies',
    timestamp: new Date().toISOString(),
    nextStep: 'Refresh the page and try logging in again',
  })

  // Clear all possible NextAuth cookie variants
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.csrf-token',
  ]

  for (const name of cookiesToClear) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      expires: new Date(0),
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: name.includes('session-token'), // Keep session-token httpOnly
    })
  }

  // Also clear from request to show in response
  response.headers.set('X-Cleared-Cookies', cookiesToClear.join(', '))

  return response
}

// GET deshabilitado explícitamente (anti CSRF): forzar POST.
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed. Use POST.' }, { status: 405, headers: { Allow: 'POST' } })
}
