import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import * as crypto from 'crypto'
import { createLogger } from '@/lib/shared/logger'
import { billingService } from '@/lib/domains/billing/service'
import { getMPPayment } from '@/lib/domains/billing/mercadopago'
import { prisma } from '@/lib/prisma'

const log = createLogger('MP-Webhook')

function verifyMPSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secret: string
): boolean {
  if (!xSignature || !xRequestId || !dataId || !secret) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=', 2) as [string, string])
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')

    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('id') || url.searchParams.get('data.id')

    const secret = env.MP_WEBHOOK_SECRET
    if (!secret) {
      log.error({}, 'MP_WEBHOOK_SECRET no configurado — rechazando webhook')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const valid = verifyMPSignature(xSignature, xRequestId, id, secret)
    if (!valid) {
      log.warn({ xRequestId }, 'Firma de webhook inválida')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    log.info({ topic, id }, 'Webhook de Mercado Pago recibido (firma válida)')

    // Procesar según el topic
    if (topic === 'payment' && id) {
      log.info({ paymentId: id }, 'Procesando pago desde Webhook')

      // Obtener detalles del pago desde la API de Mercado Pago
      try {
        const mpPayment = getMPPayment()
        const payment = await mpPayment.get({ id })
        const status = payment.status ?? 'pending'
        const externalReference = payment.external_reference ?? null

        await billingService.syncSubscriptionFromPayment({
          paymentId: id,
          status,
          externalReference,
        })

        log.info({ paymentId: id, status }, 'Pago sincronizado exitosamente')
      } catch (mpError) {
        log.error(
          { paymentId: id, error: mpError instanceof Error ? mpError.message : String(mpError) },
          'Error al obtener detalles del pago de MP — retornando 502 para reintento'
        )
        // Retornamos 502 para que MP reintente el webhook con backoff exponencial
        return NextResponse.json({ error: 'Upstream API error' }, { status: 502 })
      }
    } else if (topic === 'subscription_preapproval' && id) {
      log.info({ subscriptionId: id }, 'Procesando suscripción desde Webhook')

      try {
        // Buscar la suscripción por mpPaymentId (preapproval_id)
        const subscription = await prisma.saasSubscription.findFirst({
          where: { mpPaymentId: id },
        })

        if (subscription) {
          // Si el webhook indica cancelación, actualizamos el estado
          await prisma.saasSubscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE' }, // Re-activar en cada notificación de preapproval
          })
          log.info({ subscriptionId: id }, 'Suscripción reactivada vía webhook')
        } else {
          log.warn({ subscriptionId: id }, 'No se encontró suscripción para este preapproval_id')
        }
      } catch (subError) {
        log.error(
          { subscriptionId: id, error: subError instanceof Error ? subError.message : String(subError) },
          'Error al procesar suscripción desde webhook — retornando 502 para reintento'
        )
        return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error({ err }, 'Error procesando webhook de MP')
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
