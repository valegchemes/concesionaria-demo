export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { prisma } from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rate-limit-kv'

/**
 * GET /api/billing/me
 * Devuelve las features y límites del plan activo del tenant.
 * Usado por el hook usePlanLimits() del cliente.
 */
export const GET = withTenantHandler(async (_req: NextRequest) => {
  // Rate limit: máx. 60 consultas por minuto por IP
  const blocked = await applyRateLimit(_req, { path: '/api/billing/me' })
  if (blocked) return blocked

  try {
    const user = await getCurrentUser()
    const limits = await getPlanLimits(user.companyId)

    // También devolvemos los conteos actuales para mostrar uso en la UI
    const [currentUsers, currentUnits] = await Promise.all([
      prisma.user.count({ where: { companyId: user.companyId } }),
      prisma.unit.count({ where: { companyId: user.companyId, status: 'AVAILABLE', isActive: true } }),
    ])

    return NextResponse.json({
      ...limits,
      // companyId se incluye para que el hook usePlanLimits pueda keyear su
      // caché por tenant y evitar reusar límites de otra empresa en la misma
      // sesión SPA (fuga cross-tenant).
      companyId: user.companyId,
      currentUsers,
      currentUnits,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
