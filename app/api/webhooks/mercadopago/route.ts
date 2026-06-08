export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/domains/billing/service'
import { getMPPayment } from '@/lib/domains/billing/mercadopago'
import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'
import { prisma } from '@/lib/shared/prisma'
import { createAuditLog } from '@/lib/shared/audit-log'
import { requireRateLimit, RATE_LIMITS } from '@/lib/shared/rate-limit-memory'
import * as crypto from 'crypto'

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

    // 4. Verificar firma — OBLIGATORIO. Sin secret configurado, rechazar siempre.
    const secret = env.MP_WEBHOOK_SECRET
    if (!secret) {
      log.error({}, 'MP_WEBHOOK_SECRET no configurado — rechazando webhook por seguridad')
      return new NextResponse('Webhook not configured', { status: 503 })
    }
    const valid = verifyMPSignature(xSignature, xRequestId, dataId, secret)
    if (!valid) {
      log.warn({ clientIp, xRequestId }, 'MP webhook signature invalid')
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Solo procesamos notificaciones de pagos
    if (topic !== 'payment' || !dataId) {
      log.info({ topic, dataId }, 'Unhandled MP notification type')
      return new NextResponse('OK', { status: 200 })
    }

    const eventId = `mp_${dataId}`

    // Tiempo máximo que un evento puede estar en estado 'processing' antes de
    // considerarse "trabado" (crash del servidor, timeout, etc.)
    const STALE_PROCESSING_THRESHOLD_MS = 60 * 60 * 1000 // 1 hora

    // 5. Idempotencia: verificar si ya fue procesado
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { status: true, processedAt: true, receivedAt: true },
    })

    if (existingEvent?.status === 'processed') {
      log.info({ eventId }, 'MP event already processed (idempotent)')
      return new NextResponse('OK (already processed)', { status: 200 })
    }

    if (existingEvent?.status === 'processing') {
      // Verificar si el evento está "trabado": lleva más de 1h en processing.
      // Esto ocurre cuando el servidor crasheó después de guardar en DB pero
      // antes de completar el procesamiento. En ese caso, permitimos el reintento.
      const isStale = existingEvent.receivedAt
        ? Date.now() - existingEvent.receivedAt.getTime() > STALE_PROCESSING_THRESHOLD_MS
        : false

      if (!isStale) {
        log.info({ eventId }, 'MP event already being processed')
        return new NextResponse('Processing', { status: 202 })
      }

      log.warn({ eventId, receivedAt: existingEvent.receivedAt }, 'MP event stuck in processing — retrying')
    }

    // 6. Registrar como "processing" con receivedAt para trazabilidad de idempotencia
    await prisma.webhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        source: 'mercadopago',
        type: topic,
        status: 'processing',
        payload: { dataId, topic, body },
        receivedAt: new Date(),   // Inmutable: cuándo llegó este intento
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      // En reintento de evento trabado: resetear receivedAt para el nuevo intento
      update: { status: 'processing', receivedAt: new Date() },
    })

    try {
      // 7. Consultar el pago en la API de MP
      const mpPayment = getMPPayment()
      let payment
      try {
        payment = await mpPayment.get({ id: parseInt(dataId, 10) })
      } catch (error: unknown) {
        // Si el pago no existe (error 404), es probable que sea una prueba del simulador
        const isSimulationError = error && typeof error === 'object' && 
          (('status' in error && error.status === 404) || 
           ('message' in error && typeof error.message === 'string' && error.message.includes('404')))

        if (isSimulationError) {
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
        throw error // Otros errores (timeout, credenciales, etc)
      }

      const status = payment.status ?? 'unknown'
      const externalReference = payment.external_reference ?? null
      let companyIdFromRef: string | null = null
      try {
        if (externalReference) {
          const parsed = JSON.parse(externalReference)
          if (typeof parsed?.companyId === 'string' && parsed.companyId.length > 0) {
            companyIdFromRef = parsed.companyId
          }
        }
      } catch {
        log.warn({ externalReference }, 'externalReference con formato inválido — ignorando companyId')
      }

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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await prisma.webhookEvent.update({
        where: { eventId },
        data: { status: 'failed', error: errorMsg },
      })
      throw err
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    log.error({ err: errorMsg }, 'Error processing MP webhook')
    return new NextResponse(`Webhook Error: ${errorMsg}`, { status: 500 })
  }
}
