export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/billing/me
 * Devuelve las features y límites del plan activo del tenant.
 * Usado por el hook usePlanLimits() del cliente.
 */
export const GET = withTenantHandler(async (_req: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const limits = await getPlanLimits(user.companyId)

    // También devolvemos los conteos actuales para mostrar uso en la UI
    const [currentUsers, currentUnits] = await Promise.all([
      prisma.user.count({ where: { companyId: user.companyId } }),
      prisma.unit.count({ where: { companyId: user.companyId } }),
    ])

    return NextResponse.json({
      ...limits,
      currentUsers,
      currentUnits,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
