// lib/shared/rate-limit-wrapper.ts
// Rate limiting wrapper for API routes
// Delega en lib/rate-limit-kv.ts (KV con fallback in-memory)

import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rate-limit-kv'

interface RateLimitConfig {
  maxRequests?: number  // Ignorado — configurado en rate-limit-kv.ts
  windowMs?: number     // Ignorado — configurado en rate-limit-kv.ts
  keyGenerator?: (req: NextRequest) => string
  strict?: boolean      // Si true, usa checkStrictRateLimit (5 req / 10s)
  path?: string         // Path para la key del rate limit
}

/**
 * Higher-order function to wrap API handlers with rate limiting.
 * Delegates to lib/rate-limit-kv.ts for KV-backed limiting with in-memory fallback.
 *
 * Usage:
 * export const GET = withRateLimit(async (request) => {
 *   // Your handler
 * })
 *
 * export const POST = withRateLimit(
 *   async (request) => { ... },
 *   { strict: true } // auth/payment routes
 * )
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig = {}
) {
  return async function rateLimitedHandler(request: NextRequest): Promise<NextResponse> {
    // Skip rate limiting for preflight requests
    if (request.method === 'OPTIONS') {
      return handler(request)
    }

    const path = config.path ?? new URL(request.url).pathname
    const blocked = await applyRateLimit(request, { strict: config.strict, path })

    if (blocked) {
      return blocked as NextResponse
    }

    return handler(request)
  }
}

/**
 * Stricter rate limiting for authentication endpoints.
 * Prevents brute force attacks — uses checkStrictRateLimit (5 req / 10s).
 */
export function withAuthRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, { strict: true })
}

/**
 * Standard rate limiting for public catalog (prevents scraping).
 */
export function withPublicRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, { strict: false })
}
