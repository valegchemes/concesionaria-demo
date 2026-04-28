/**
 * API Route Helper: withTenantHandler
 *
 * Wraps a Next.js API Route handler to automatically establish the tenant
 * context from the middleware-injected headers before any Prisma query runs.
 *
 * This is the "glue" between proxy.ts (which injects x-company-id into headers)
 * and the Prisma tenant extension (which reads the companyId from async context).
 *
 * USAGE:
 *   export const GET = withTenantHandler(async (request) => {
 *     // All Prisma queries inside here are automatically scoped to the tenant
 *     const units = await prisma.unit.findMany() // companyId injected automatically
 *     return successResponse(units)
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/shared/tenant'
import { errorResponse } from '@/lib/shared/api-response'
import { ForbiddenError } from '@/lib/shared/errors'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('TenantHandler')

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API route handler with tenant context.
 * Reads x-company-id from the middleware-injected headers and establishes
 * the AsyncLocalStorage context before calling the handler.
 *
 * @param handler - The async API route handler function
 * @returns A wrapped handler that runs within the tenant context
 */
export function withTenantHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const companyId = request.headers.get('x-company-id')

    if (!companyId) {
      log.warn({ path: request.nextUrl.pathname }, '[TenantHandler] Missing x-company-id header')
      return errorResponse(
        new ForbiddenError('Autenticación requerida'),
        { path: request.nextUrl.pathname, method: request.method }
      )
    }

    return withTenantContext(companyId, () => handler(request, context))
  }
}
