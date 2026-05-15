export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/domains/billing/stripe'
import { billingService } from '@/lib/domains/billing/service'
import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'

import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'
import { prisma } from '@/lib/shared/prisma'
import { createAuditLog } from '@/lib/shared/audit-log'
import { requireRateLimit, RATE_LIMITS } from '@/lib/shared/rate-limit-memory'

const log = createLogger('StripeWebhook')

// IPs oficiales de Stripe para validación de origen
// Fuente: https://stripe.com/docs/ips
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  '13.235.122.149',
  '18.211.135.69',
  '35.154.171.200',
  '52.15.183.38',
  '54.88.130.119',
  '54.88.130.237',
  '54.187.174.169',
  '54.187.205.235',
  '54.187.216.72',
]

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting (protección contra spam)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await requireRateLimit(`webhook:stripe:${clientIp}`, RATE_LIMITS.WEBHOOK)

    // 2. Validar origen (solo en producción)
    if (env.NODE_ENV === 'production') {
      if (!STRIPE_WEBHOOK_IPS.includes(clientIp)) {
        log.warn({ clientIp }, 'Webhook request from unauthorized IP')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const body = await req.text()
    const signature = req.headers.get('stripe-signature') as string

    const secret = env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      log.error({}, 'STRIPE_WEBHOOK_SECRET is not configured')
      return new NextResponse('Webhook Error: Stripe webhook secret not configured', { status: 500 })
    }

    // 3. Verificar firma de Stripe
    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret)
    } catch (err: any) {
      log.error({ err, signature }, 'Webhook signature verification failed')
      return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
    }

    // 4. Validar idempotencia con base de datos (sin Redis)
    const eventId = event.id
    
    // Verificar si ya fue procesado
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { status: true, processedAt: true },
    })

    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        log.info({ eventId, processedAt: existingEvent.processedAt }, 'Event already processed (idempotent)')
        return new NextResponse('OK (already processed)', { status: 200 })
      } else if (existingEvent.status === 'processing') {
        log.warn({ eventId }, 'Event currently being processed by another instance')
        return new NextResponse('Processing', { status: 202 })
      }
    }

    // 5. Marcar como procesando (lock en DB)
    await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        source: 'stripe',
        type: event.type,
        status: 'processing',
        payload: event as any,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      },
      update: {
        status: 'processing',
        payload: event as any,
      },
    })

    // 6. Procesar evento
    try {
      await processStripeEvent(event)

      // 7. Marcar como procesado exitosamente
      await prisma.webhookEvent.update({
        where: { eventId },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      })

      log.info({ eventId, type: event.type }, 'Stripe event processed successfully')
      return new NextResponse('OK', { status: 200 })
    } catch (err: any) {
      // Marcar como fallido para permitir retry
      await prisma.webhookEvent.update({
        where: { eventId },
        data: {
          status: 'failed',
          error: err.message,
        },
      })
      throw err
    }
  } catch (err: any) {
    log.error({ err }, 'Error processing webhook')
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 500 })
  }
}

/**
 * Procesa eventos de Stripe y actualiza la base de datos
 */
async function processStripeEvent(event: any) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const companyId = subscription.metadata?.companyId

      // Validar que el evento tenga companyId
      if (!companyId) {
        log.error({ subscriptionId: subscription.id }, 'Subscription missing companyId metadata')
        throw new Error('Subscription missing companyId metadata')
      }

      // Sincronizar estado
      await billingService.syncSubscriptionStatus(subscription.id, companyId)

      // Audit log
      await createAuditLog({
        action: 'webhook_received',
        resource: 'StripeSubscription',
        resourceId: subscription.id,
        after: {
          type: event.type,
          status: subscription.status,
          planId: subscription.items.data[0]?.price?.id,
        },
        companyId,
        userId: null,
      })
      break
    }

    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const companyId = invoice.subscription_details?.metadata?.companyId

      if (companyId) {
        await createAuditLog({
          action: 'webhook_received',
          resource: 'StripeInvoice',
          resourceId: invoice.id,
          after: {
            type: event.type,
            amount: invoice.amount_paid,
            status: invoice.status,
          },
          companyId,
          userId: null,
        })
      }
      break
    }

    default:
      log.info({ type: event.type }, 'Unhandled event type')
  }
}
