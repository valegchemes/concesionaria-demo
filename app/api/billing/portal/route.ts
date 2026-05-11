export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'
import { computedEnv } from '@/lib/env'
import { withTenantHandler } from '@/lib/shared/with-tenant'

export const POST = withTenantHandler(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const customerId = await billingService.getOrCreateCustomer(user.companyId)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${computedEnv.PUBLIC_URL}/app/settings/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
