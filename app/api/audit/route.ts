export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/shared/auth-helpers'
import { prismaBypass } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { cursorPaginate } from '@/lib/shared/cursor-pagination'
import { requireRateLimit, RATE_LIMITS, getRequestIdentifier } from '@/lib/shared/rate-limit-memory'

const log = createLogger('API:AuditLog')

export const GET = withTenantHandler(async (request: NextRequest) => {
  try {
    // Rate limiting
    const identifier = getRequestIdentifier(request)
    await requireRateLimit(identifier, RATE_LIMITS.AUTHENTICATED_API)
    
    const user = await requirePermission('team', 'manage_all')
    const { searchParams } = new URL(request.url)
    const resource = searchParams.get('resource') ?? undefined

    const where = {
      companyId: user.companyId,
      ...(resource && resource !== 'ALL' ? { resource } : {}),
    }

    // Usar cursor pagination para mejor performance en tablas grandes
    const result = await cursorPaginate({
      params: {
        cursor: searchParams.get('cursor'),
        limit: searchParams.get('limit') || '50',
      },
      query: async (options) => {
        return prismaBypass.auditLog.findMany({
          ...options,
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            resource: true,
            resourceId: true,
            createdAt: true,
            ipAddress: true,
            user: { select: { name: true, email: true } },
          },
        })
      },
    })

    return NextResponse.json({
      logs: result.items,
      pagination: result.pagination,
    })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch audit logs')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
})

