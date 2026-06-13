import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, validateRequest as validateRequestBody, CommonSchemas } from './validation'
import {
  applyRateLimiting,
  validateCsrfMiddleware,
  addSecurityHeaders,
  addCsrfToken,
  logSecurityEvent,
  logAuthFailure,
  logRateLimitExceeded,
  logCsrfInvalid,
  logValidationFailure,
} from './middleware'
import type { SecurityConfig } from './middleware'

// ============================================================================
// SECURITY WRAPPER FOR API ROUTES
// ============================================================================

export interface SecureRouteConfig extends SecurityConfig {
  // Validation
  bodySchema?: z.ZodSchema
  querySchema?: z.ZodSchema
  paramsSchema?: z.ZodSchema
  // Auth
  requireAuth?: boolean
  requirePermission?: { resource: string; action: string }
  requireRole?: string | string[]
  // Security
  skipCsrf?: boolean
  skipRateLimit?: boolean
}

import { z } from 'zod'

type Handler<T = unknown> = (
  request: NextRequest,
  context: { params?: Record<string, string>; user?: any; validatedBody?: any; validatedQuery?: any }
) => Promise<NextResponse>

export function createSecureRoute<T = unknown>(
  handler: Handler<T>,
  config: SecureRouteConfig = {}
) {
  return async function secureHandler(
    request: NextRequest,
    context: { params?: Record<string, string> }
  ): Promise<NextResponse> {
    const startTime = Date.now()
    const path = new URL(request.url).pathname
    const method = request.method

    try {
      // 1. Rate Limiting
      if (!config.skipRateLimit) {
        const rateLimitResult = await applyRateLimiting(request, { rateLimit: { strict: true } })
        if (rateLimitResult) return rateLimitResult
      }

      // 2. CSRF Protection
      if (!config.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const csrfResult = validateCsrfMiddleware(request as NextRequest)
        if (csrfResult) return csrfResult
      }

      // 3. Authentication check
      let authUser: any = null
      if (config.requireAuth || config.requirePermission || config.requireRole) {
        const { requireAuth, getCurrentUser, requirePermission, requireRole } = await import('@/lib/shared/auth-helpers')
        try {
          await requireAuth()
          if (config.requirePermission) {
            await requirePermission(config.requirePermission.resource, config.requirePermission.action)
          }
          if (config.requireRole) {
            const requiredRoles = Array.isArray(config.requireRole) ? config.requireRole : [config.requireRole]
            await requireRole(config.requireRole)
          }
          authUser = await getCurrentUser()
        } catch {
          logAuthFailure(request as any, 'Authentication failed')
          return NextResponse.json(
            { error: 'No autorizado', code: 'UNAUTHORIZED' },
            { status: 401 }
          )
        }
      }

      // 4. CSRF Protection for mutations
      if (!config.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const csrfResult = validateCsrfMiddleware(request as any)
        if (csrfResult) return csrfResult
      }

      // 5. Input Validation
      let validatedBody: any
      let validatedQuery: any
      let validatedParams: any

      if (config.bodySchema) {
        const result = await validateRequestBody(request as any, config.bodySchema as any)
        if (!result.success) return result.error as NextResponse
        validatedBody = result.data
      }

      if (config.querySchema) {
        const url = new URL(request.url)
        const params = Object.fromEntries(new URL(request.url).searchParams.entries())
        const result = CommonSchemas.pagination.merge(CommonSchemas.search).safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
        if (!result.success) {
          logValidationFailure(request, 'query', result.error.flatten().fieldErrors)
          return NextResponse.json(
            { error: 'Parámetros de consulta inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten().fieldErrors },
            { status: 400 }
          )
        }
        validatedQuery = result.data
      }

      // 5. Execute handler
      const context = {
        params: request.nextUrl.pathname.split('/').filter(Boolean).slice(2).reduce((acc, part, i) => {
          if (i % 2 === 0) {
            const key = part
            const nextPart = request.nextUrl.pathname.split('/').filter(Boolean).slice(2)[i + 1]
            if (nextPart) acc[key] = nextPart
          }
          return acc
        }, {} as Record<string, string>),
        user: null as any,
        validatedBody: undefined as any,
        validatedQuery: undefined as any,
      }

      // Execute handler
      const response = await handler(request as any, context)

      // 6. Add security headers
      const securedResponse = addSecurityHeaders(response)

      // Add CSP nonce if present
      if (securedResponse.headers.has('x-csp-nonce')) {
        // Already handled by addSecurityHeaders
      }

      // Add CSRF token for mutations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        addCsrfToken(securedResponse)
      }

      // Log successful request
      const reqPath = new URL(request.url).pathname
      const duration = Date.now() - Date.now()
      logSecurityEvent({
        type: 'auth_failed',
        ip: 'unknown',
        path: reqPath,
        method: request.method,
        userAgent: request.headers.get('user-agent') || 'unknown',
        details: { eventType: 'request_completed', duration: Date.now() - startTime },
      })

      return securedResponse
    } catch (error) {
      const reqPath = new URL(request.url).pathname
      const duration = Date.now() - Date.now()
      logSecurityEvent({
        type: 'auth_failed',
        ip: 'unknown',
        path: reqPath,
        method: request.method,
        userAgent: 'unknown',
        details: { eventType: 'error', duration: Date.now() - startTime },
      })

      console.error('[API Error]', { path: new URL(request.url).pathname, error })

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos de entrada inválidos', code: 'VALIDATION_ERROR', details: error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      if (error instanceof Response) return error as unknown as NextResponse

      return NextResponse.json(
        { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

export function withAuth(handler: any) {
  return createSecureRoute(handler, { requireAuth: true })
}

export function withPermission(resource: string, action: string) {
  return (handler: any) => createSecureRoute(handler, { requirePermission: { resource, action } })
}

export function withRole(role: string | string[]) {
  return (handler: any) => createSecureRoute(handler, { requireRole: role })
}

export function withRateLimit(config: { limit: number; windowSeconds: number; prefix?: string }) {
  return (handler: any) => createSecureRoute(handler, { rateLimit: { custom: config as { limit: number; windowSeconds: number; prefix: string } } })
}

export function withCsrfProtection(handler: any) {
  return createSecureRoute(handler, { skipCsrf: false })
}

export function withoutCsrf(handler: any) {
  return createSecureRoute(handler, { skipCsrf: true })
}

export function withoutRateLimit(handler: any) {
  return createSecureRoute(handler, { skipRateLimit: true })
}

export function publicRoute(handler: any) {
  return createSecureRoute(handler, { skipRateLimit: false, skipCsrf: false })
}

export function strictRoute(handler: any) {
  return createSecureRoute(handler, { rateLimit: { strict: true }, skipCsrf: false, requireAuth: true })
}

export function adminRoute(handler: any) {
  return createSecureRoute(handler, { requireAuth: true, requireRole: 'ADMIN' })
}

export function billingRoute(handler: any) {
  return createSecureRoute(handler, { requireAuth: true, rateLimit: { strict: true, custom: { limit: 10, windowSeconds: 30, prefix: 'rl:billing' } } })
}

export function webhookRoute(handler: any) {
  return createSecureRoute(handler, { skipCsrf: true, rateLimit: { custom: { limit: 1000, windowSeconds: 60, prefix: 'rl:webhook' } } })
}

// Export commonly used items
export {
  addSecurityHeaders,
  addCsrfToken,
  validateCsrfMiddleware,
  getSecurityRequestIdentifier,
  logSecurityEvent,
  logAuthFailure,
  logRateLimitExceeded,
  logCsrfInvalid,
  logValidationFailure,
  logSuspiciousInput,
  applyRateLimiting,
  generateCsrfToken,
  validateCsrfToken,
  generateNonce,
  RATE_LIMITS,
  STRICT_RATE_LIMITS,
} from './middleware'

export { validateRequest, CommonSchemas, sanitizeHtml, sanitizeForLog, detectSuspiciousInput } from './validation'
export type { SecurityConfig } from './middleware'