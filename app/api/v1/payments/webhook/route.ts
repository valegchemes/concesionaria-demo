import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/domains/billing/service'
import { createLogger } from '@/lib/shared/logger'
import { prisma } from '@/lib/shared/prisma'
import { SubscriptionStatus } from '@prisma/client'

const log = createLogger('MP-Webhook')

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    // Extraer query params comunes de MP
    const topic = url.searchParams.get('topic') || url.searchParams.get('type')
    const id = url.searchParams.get('id') || url.searchParams.get('data.id')

    log.info({ topic, id }, 'Webhook de Mercado Pago recibido')

    // Validamos el origen si es posible con un secret
    // En Producción se puede validar el header x-signature de MP.

    // Dependiendo del topic actuamos
    if (topic === 'payment' && id) {
      // Fetch payment details from MercadoPago API (opcional, en esta demo 
      // confiaremos en la sincronización o usaremos el SDK).
      
      // Para simular la validación, si recibimos un ID, actualizamos la subscripción 
      // vinculada a ese paymentId.
      log.info({ paymentId: id }, 'Procesando pago desde Webhook')

      // Nota: En un entorno real, usarías mercadopago SDK para buscar el pago:
      // const payment = await mercadopago.payment.get(id)
      // const status = payment.status
      // const external_reference = payment.external_reference
      // await billingService.syncSubscriptionFromPayment({ paymentId: id, status, externalReference: external_reference })
    } else if (topic === 'subscription_preapproval' && id) {
      log.info({ subscriptionId: id }, 'Procesando suscripción desde Webhook')
      
      // En un entorno real, usarías mercadopago SDK para buscar la suscripción preapproval:
      // const preapproval = await mercadopago.preapproval.get(id)
      // const status = preapproval.status // 'authorized', 'paused', 'cancelled'
      // const external_reference = preapproval.external_reference
      
      // Si se cancela, debemos actualizar la DB:
      // await prisma.saasSubscription.updateMany({
      //   where: { mpPaymentId: id },
      //   data: { status: 'CANCELED' }
      // })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    log.error({ err }, 'Error procesando webhook de MP')
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
