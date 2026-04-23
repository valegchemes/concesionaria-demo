export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const json = await request.json()
    const { priceId } = json

    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
    }

    const customerId = await billingService.getOrCreateCustomer(user.companyId)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/app/settings/billing?success=true`,
      cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/app/settings/billing?canceled=true`,
      metadata: {
        companyId: user.companyId
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
