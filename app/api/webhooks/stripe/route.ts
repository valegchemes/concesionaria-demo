export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'
import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'

const log = createLogger('StripeWebhook')

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') as string

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    log.error({ err }, 'Webhook signature verification failed')
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as any
        await billingService.syncSubscriptionStatus(subscription.id)
        break
      // handle other events...
      default:
        log.info({ type: event.type }, 'Unhandled event type')
    }
  } catch (err: any) {
    log.error({ err }, 'Error processing webhook')
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 500 })
  }

  return new NextResponse('OK', { status: 200 })
}
