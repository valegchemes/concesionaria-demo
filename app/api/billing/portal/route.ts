export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const customerId = await billingService.getOrCreateCustomer(user.companyId)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/app/settings/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
