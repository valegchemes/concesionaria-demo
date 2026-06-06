export const revalidate = 3600
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { billingService } from '@/lib/domains/billing/service'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { applyRateLimit } from '@/lib/rate-limit-kv'

export const GET = withTenantHandler(async (_request: NextRequest) => {
  // Rate limit: máx. 60 consultas por minuto por IP
  const blocked = await applyRateLimit(_request, { path: '/api/billing/plans' })
  if (blocked) return blocked

  try {
    await getCurrentUser()
    const plans = await billingService.getAllowedPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
