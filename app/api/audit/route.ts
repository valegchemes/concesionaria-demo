export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/shared/auth-helpers'
import { prismaBypass } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:AuditLog')

export async function GET(request: Request) {
  try {
    const user = await requirePermission('team', 'manage_all')
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const resource = searchParams.get('resource') ?? undefined

    const where = {
      companyId: user.companyId,
      ...(resource && resource !== 'ALL' ? { resource } : {}),
    }

    const [logs, total] = await Promise.all([
      prismaBypass.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          createdAt: true,
          ipAddress: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prismaBypass.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, limit })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch audit logs')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
