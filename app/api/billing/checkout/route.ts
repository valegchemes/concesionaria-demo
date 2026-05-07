export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'
import { computedEnv } from '@/lib/env'

const CheckoutSchema = z.object({
  priceId: z.string().trim().min(1, 'priceId is required'),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const json = await request.json()
    const { priceId } = CheckoutSchema.parse(json)

    const plan = await billingService.getPlanByStripePriceId(priceId)
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive plan' }, { status: 400 })
    }

    const customerId = await billingService.getOrCreateCustomer(user.companyId)
    const idempotencyKey = `checkout_${user.companyId}_${priceId}`

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${computedEnv.PUBLIC_URL}/app/settings/billing?success=true`,
        cancel_url: `${computedEnv.PUBLIC_URL}/app/settings/billing?canceled=true`,
        metadata: {
          companyId: user.companyId,
          userId: user.id,
          planId: plan.id,
        },
      },
      { idempotencyKey }
    )

    if (!session.url) {
      return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
