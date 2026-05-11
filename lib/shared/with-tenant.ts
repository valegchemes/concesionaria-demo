/**
 * API Route Helper: withTenantHandler
 *
 * Wraps a Next.js API Route handler to automatically establish the tenant
 * context from the middleware-injected headers before any Prisma query runs.
 *
 * This is the "glue" between middleware.ts (which injects x-company-id into headers)
 * and the Prisma tenant extension (which reads the companyId from async context).
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
import { ForbiddenError } from '@/lib/shared/errors'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('TenantHandler')

/**
 * Acepta tanto NextResponse como Response para compatibilidad con withErrorHandling.
 * Usa `any` en context para compatibilidad con handlers que tienen { params } tipado
 * (contravarianza de parámetros de función en TypeScript).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<Response>

/**
 * Higher-order function que envuelve un handler de ruta con tenant context.
 * Lee x-company-id desde los headers inyectados por el middleware y establece
 * el contexto AsyncLocalStorage antes de invocar el handler.
 *
 * Fallback: si el header no existe (ej. dev local), intenta resolver companyId
 * desde la sesión de NextAuth para evitar roturas en entorno de desarrollo.
 *
 * @param handler - El handler async de la ruta API
 * @returns Un handler envuelto que corre dentro del tenant context
 */
export function withTenantHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    let companyId = request.headers.get('x-company-id')

    // Fallback de sesión: útil en desarrollo local donde el middleware no siempre corre.
    // En producción, el middleware.ts ya garantiza que x-company-id siempre existe.
    if (!companyId) {
      try {
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/app/api/auth/[...nextauth]/auth-options')
        const session = await getServerSession(authOptions)
        companyId = (session?.user as { companyId?: string } | undefined)?.companyId ?? null
      } catch {
        // Ignorar — si falla la sesión, retornar error de auth
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
