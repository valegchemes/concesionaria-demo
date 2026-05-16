export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/domains/billing/service'
import { getMPPayment } from '@/lib/domains/billing/mercadopago'
import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'
import { prisma } from '@/lib/shared/prisma'
import { createAuditLog } from '@/lib/shared/audit-log'
import { requireRateLimit, RATE_LIMITS } from '@/lib/shared/rate-limit-memory'
import crypto from 'crypto'

const log = createLogger('MPWebhook')

function verifyMPSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secret: string
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false

  // Mercado Pago sends: ts=...&v1=...
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
    // 1. Rate limiting
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    await requireRateLimit(`webhook:mp:${clientIp}`, RATE_LIMITS.WEBHOOK)

    // 2. Leer body y headers de MP
    const body = await req.text()
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')

    // 3. Parsear query params del webhook
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') ?? url.searchParams.get('type')
    const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')

    // 4. Verificar firma si el secret está configurado
    const secret = env.MP_WEBHOOK_SECRET
    if (secret) {
      const valid = verifyMPSignature(xSignature, xRequestId, dataId, secret)
      if (!valid) {
        log.warn({ clientIp, xRequestId }, 'MP webhook signature invalid')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    // Solo procesamos notificaciones de pagos
    if (topic !== 'payment' || !dataId) {
      log.info({ topic, dataId }, 'Unhandled MP notification type')
      return new NextResponse('OK', { status: 200 })
    }

    const eventId = `mp_${dataId}`

    // 5. Idempotencia: verificar si ya fue procesado
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { status: true, processedAt: true },
    })

    if (existingEvent?.status === 'processed') {
      log.info({ eventId }, 'MP event already processed (idempotent)')
      return new NextResponse('OK (already processed)', { status: 200 })
    }

    if (existingEvent?.status === 'processing') {
      return new NextResponse('Processing', { status: 202 })
    }

    // 6. Registrar como "processing"
    await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        source: 'mercadopago',
        type: topic,
        status: 'processing',
        payload: { dataId, topic, body },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: { status: 'processing' },
    })

    try {
      // 7. Consultar el pago en la API de MP
      const mpPayment = getMPPayment()
      let payment
      try {
        payment = await mpPayment.get({ id: parseInt(dataId, 10) })
      } catch (mpErr: any) {
        // Si el pago no existe (error 404), es probable que sea una prueba del simulador
        if (mpErr.status === 404 || mpErr.message?.includes('404')) {
          log.warn({ dataId }, 'MP payment not found (likely simulation)')
          await prisma.webhookEvent.update({
            where: { eventId },
            data: { 
              status: 'processed', 
              processedAt: new Date(),
              error: 'Payment not found in MP (Simulation)'
            },
          })
          return new NextResponse('OK (Simulation/Not Found)', { status: 202 })
        }
        throw mpErr // Otros errores (timeout, credenciales, etc)
      }

      const status = payment.status ?? 'unknown'
      const externalReference = payment.external_reference ?? null
      const companyIdFromRef = externalReference
        ? JSON.parse(externalReference).companyId
        : null

      // 8. Sincronizar con la suscripción local
      await billingService.syncSubscriptionFromPayment({
        paymentId: dataId,
        status,
        externalReference,
      })

      // 9. Audit log
      if (companyIdFromRef) {
        await createAuditLog({
          action: 'webhook_received',
          resource: 'MPPayment',
          resourceId: dataId,
          after: { status, topic },
          companyId: companyIdFromRef,
          userId: null,
        })
      }

      // 10. Marcar como procesado
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'processed', processedAt: new Date() },
      })

      log.info({ eventId, status }, 'MP payment webhook processed')
      return new NextResponse('OK', { status: 200 })
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'failed', error: err.message },
      })
      throw err
    }
  } catch (err: any) {
    log.error({ err }, 'Error processing MP webhook')
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 500 })
  }
}
