/**
 * API Route Helper: withTenantHandler
 *
 * Wraps a Next.js API Route handler to automatically establish the tenant
 * context before any Prisma query runs.
 *
 * SECURITY: El `companyId` se resuelve SIEMPRE desde la sesión de NextAuth
 * (fuente autoritativa, firmada en el JWT). El header `x-company-id` NO se usa
 * como fuente de tenant porque los headers HTTP son entrada de cliente mutable
 * (un usuario del tenant A podría spoofear `x-company-id` del tenant B).
 * El header solo se respeta en desarrollo local (sin proxy) para conveniencia.
 *
 * USAGE:
 *   export const GET = withTenantHandler(async (request) => {
 *     // All Prisma queries inside here are automatically scoped to the tenant
 *     const units = await prisma.unit.findMany() // companyId injected automatically
 *     return successResponse(units)
 *   })
 *
 * COMPOSITION with withErrorHandling:
 *   export const GET = withTenantHandler(withErrorHandling(async (request) => { ... }))
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/shared/tenant'
import { errorResponse } from '@/lib/shared/api-response'
import { ForbiddenError, RateLimitError } from '@/lib/shared/errors'
import { createLogger } from '@/lib/shared/logger'
import { requireRateLimit, getRequestIdentifier, RATE_LIMITS } from '@/lib/shared/rate-limit-memory'

const log = createLogger('TenantHandler')

/**
 * Acepta tanto NextResponse como Response para compatibilidad con withErrorHandling.
 * Usa `any` en context para compatibilidad con handlers que tienen { params } tipado
 * (contravarianza de parámetros de función en TypeScript).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context: any) => Promise<Response>

/**
 * Higher-order function que envuelve un handler de ruta con:
 * 1. Rate limiting para métodos de mutación (POST, PUT, PATCH, DELETE)
 * 2. Tenant context isolation (companyId)
 *
 * NOTA: Las rutas de webhook (/api/webhooks, /api/v1/payments/webhook) NO usan
 * this handler, por lo que no se ven afectadas por el rate limiting.
 */
// Usamos el rate limit estándar de APIs autenticadas (300 req/min)
const MUTATION_RATE_LIMIT = RATE_LIMITS.AUTHENTICATED_API

/**
 * Higher-order function que envuelve un handler de ruta con:
 * 1. Rate limiting para métodos de mutación (POST, PUT, PATCH, DELETE)
 * 2. Tenant context isolation (companyId)
 */
export function withTenantHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    // Rate limiting para mutaciones (previene DoS y brute force)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        const identifier = getRequestIdentifier(request)
        await requireRateLimit(identifier, MUTATION_RATE_LIMIT)
      } catch (error) {
        if (error instanceof RateLimitError) {
          return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.', code: 'RATE_LIMIT_EXCEEDED' },
            { status: 429 }
          ) as NextResponse
        }
        throw error
      }
    }

    // SECURITY: resolver companyId SIEMPRE desde la sesión (JWT firmado).
    // En producción NUNCA confiamos en el header x-company-id del cliente.
    // Solo en desarrollo local (sin proxy corriendo) lo aceptamos como atajo.
    const isProduction = process.env.NODE_ENV === 'production'
    const headerCompanyId = request.headers.get('x-company-id')
    const trustHeader = !isProduction && headerCompanyId

    let companyId: string | null = null

    if (trustHeader) {
      companyId = headerCompanyId
    } else {
      try {
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/app/api/auth/[...nextauth]/auth-options')
        const session = await getServerSession(authOptions)
        companyId = (session?.user as { companyId?: string } | undefined)?.companyId ?? null
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err), path: request.nextUrl.pathname },
          '[TenantHandler] Error resolviendo sesión'
        )
      }
    }

    if (!companyId) {
      log.warn({ path: request.nextUrl.pathname }, '[TenantHandler] No se pudo resolver companyId')
      return errorResponse(
        new ForbiddenError('Autenticación requerida'),
        { path: request.nextUrl.pathname, method: request.method }
      ) as NextResponse
    }

    return withTenantContext(companyId, () => handler(request, context)) as Promise<NextResponse>
  }
}
