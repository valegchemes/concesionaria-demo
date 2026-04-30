export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from './auth-options'
import { applyRateLimit } from '@/lib/rate-limit-kv'

const handler = NextAuth(authOptions)

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params
  return handler(request, { params })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const blocked = await applyRateLimit(request, { strict: true, path: request.nextUrl.pathname })
  if (blocked) {
    return blocked
  }

  const params = await context.params
  return handler(request, { params })
}
