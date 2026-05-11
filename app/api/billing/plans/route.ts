export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { billingService } from '@/lib/domains/billing/service'
import { withTenantHandler } from '@/lib/shared/with-tenant'

export const GET = withTenantHandler(async (_request: NextRequest) => {
  try {
    await getCurrentUser()
    const plans = await billingService.getAllowedPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
