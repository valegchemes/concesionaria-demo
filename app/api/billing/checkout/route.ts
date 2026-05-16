export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { billingService } from '@/lib/domains/billing/service'
import { computedEnv } from '@/lib/env'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const CheckoutSchema = z.object({
  priceId: z.string().trim().min(1, 'priceId is required'),
})

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const json = await request.json()
    const { priceId } = CheckoutSchema.parse(json)

    const plan = await billingService.getPlanByStripePriceId(priceId)
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 })
    }

    await billingService.getOrCreateCustomer(user.companyId)

    const baseUrl = computedEnv.PUBLIC_URL ?? 'http://localhost:3000'

    const preference = await billingService.createCheckoutPreference({
      companyId: user.companyId,
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      planDescription: plan.description ?? null,
      price: Number(plan.price),
      currency: plan.currency,
      successUrl: `${baseUrl}/app/settings/billing?success=true`,
      failureUrl: `${baseUrl}/app/settings/billing?canceled=true`,
      pendingUrl: `${baseUrl}/app/settings/billing?pending=true`,
    })

    const initPoint = preference.init_point
    if (!initPoint) {
      return NextResponse.json({ error: 'Unable to create checkout preference' }, { status: 500 })
    }

    return NextResponse.json({ url: initPoint })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
