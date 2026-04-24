// lib/shared/rate-limit-wrapper.ts
// Rate limiting wrapper for API routes

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { RateLimitError } from '@/lib/shared/errors'

interface RateLimitConfig {
  maxRequests?: number  // Default: 100
  windowMs?: number     // Default: 60 seconds
  keyGenerator?: (req: NextRequest) => string
}

/**
 * Get client IP from request
 * In production behind Vercel/CDN, check x-forwarded-for
 */
function getClientIP(request: NextRequest): string {
  // Vercel specific headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  // Fallback to other headers
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Last resort: use a cookie or return unknown
  return 'unknown'
}

/**
 * Default key generator: IP + pathname
 */
function defaultKeyGenerator(request: NextRequest): string {
  const ip = getClientIP(request)
  const path = new URL(request.url).pathname
  return `${ip}:${path}`
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 * 
 * Usage:
 * export const GET = withRateLimit(async (request) => {
 *   // Your handler
 * })
 * 
 * export const POST = withRateLimit(
 *   async (request) => { ... },
 *   { maxRequests: 10, windowMs: 60000 } // 10 requests per minute
 * )
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig = {}
) {
  const {
    maxRequests = 100,
    windowMs = 60000, // 1 minute
    keyGenerator = defaultKeyGenerator,
  } = config

  return async function rateLimitedHandler(request: NextRequest): Promise<NextResponse> {
    // Skip rate limiting for preflight requests
    if (request.method === 'OPTIONS') {
      return handler(request)
    }

    const key = keyGenerator(request)
    const path = new URL(request.url).pathname
    
    // Check rate limit using existing store
    // Note: In production with multiple instances, use Redis or Vercel KV
    const isAllowed = checkRateLimit(key, path)
    
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
          retryAfter: Math.ceil(windowMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(windowMs / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // Add rate limit headers to successful responses
    const response = await handler(request)
    
    // Clone response to add headers
    const newResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
    
    newResponse.headers.set('X-RateLimit-Limit', String(maxRequests))
    newResponse.headers.set('X-RateLimit-Remaining', 'available') // Simplified
    
    return newResponse
  }
}

/**
 * Stricter rate limiting for authentication endpoints
 * Prevents brute force attacks
 */
export function withAuthRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, {
    maxRequests: 5,      // 5 attempts
    windowMs: 300000,   // per 5 minutes
    keyGenerator: (req) => {
      const ip = getClientIP(req)
      const body = req.body ? 'with-body' : 'no-body'
      return `auth:${ip}:${body}`
    },
  })
}

/**
 * Stricter rate limiting for public catalog (prevents scraping)
 */
export function withPublicRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return withRateLimit(handler, {
    maxRequests: 60,    // 60 requests
    windowMs: 60000,    // per minute
    keyGenerator: (req) => {
      const ip = getClientIP(req)
      return `public:${ip}`
    },
  })
}
