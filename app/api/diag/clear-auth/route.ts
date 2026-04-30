/**
 * API para limpiar cookies de NextAuth (utility endpoint)
 * GET /api/diag/clear-auth — Force clear all next-auth.* cookies
 * 
 * Usado para troubleshooting cuando el navegador tiene cookies rotas/stale
 * que no se limpian normalmente.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
