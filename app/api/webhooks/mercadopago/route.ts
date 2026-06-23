export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/domains/billing/service'
import { getMPPayment } from '@/lib/domains/billing/mercadopago'
import { createLogger } from '@/lib/shared/logger'
import { env } from '@/lib/env'
import { prisma } from '@/lib/shared/prisma'
import { createAuditLog } from '@/lib/shared/audit-log'
import { requireRateLimit, RATE_LIMITS } from '@/lib/shared/rate-limit-memory'
import { timingSafeStringEqual } from '@/lib/shared/timing-safe-equal'
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

  // timingSafeStringEqual evita el throw de timingSafeEqual cuando las
  // longitudes difieren (que rompería la garantía timing-safe y daría 500).
  return timingSafeStringEqual(expected, v1)
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

    // 5. Idempotencia ATÓMICA (claim con updateMany condicional).
    // Antes había un TOCTOU: findUnique → upsert permitía que dos reintentos
    // concurrentes pasaran ambos el guard y procesaran dos veces. Ahora hacemos
    // un claim atómico: solo el primero que logra la transición a 'processing'
    // obtiene count=1; los demás reciben count=0 y se tratan como duplicados.

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
      select: { status: true, processedAt: true, receivedAt: true },
    })

    if (existingEvent?.status === 'processed') {
      log.info({ eventId }, 'MP event already processed (idempotent)')
      return new NextResponse('OK (already processed)', { status: 200 })
    }

    const staleThresholdDate = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS)
    const isStaleProcessing =
      existingEvent?.status === 'processing' &&
      existingEvent.receivedAt
        ? existingEvent.receivedAt.getTime() < staleThresholdDate.getTime()
        : false

    // Claim atómico: transición a 'processing' solo si el estado actual NO es
    // 'processing' (caso create) o si ya estaba pero está stale (recuperación).
    // Para un evento nuevo usamos upsert con un guard; para existente usamos
    // updateMany condicional que retorna count=0 si otro lo tomó antes.
    let claimed = false
    if (!existingEvent) {
      // Intentar crear; si otro lo creó concurrentemente, la PK única falla y
      // caemos en el flujo de "ya en procesamiento".
      try {
        await prisma.webhookEvent.create({
          data: {
            eventId,
            source: 'mercadopago',
            type: topic,
            status: 'processing',
            payload: { dataId, topic, body },
            receivedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        claimed = true
      } catch {
        // Otro worker lo creó entre nuestro findUnique y este create.
        claimed = false
      }
    } else {
      // Existente: reclamar atómicamente solo si está libre o stale.
      const result = await prisma.webhookEvent.updateMany({
        where: {
          eventId,
          OR: [
            { status: { not: 'processing' } },
            ...(isStaleProcessing ? [{ status: 'processing', receivedAt: { lt: staleThresholdDate } }] : []),
          ],
        },
        data: { status: 'processing', receivedAt: new Date() },
      })
      claimed = result.count > 0
    }

    if (!claimed) {
      log.info({ eventId }, 'MP event already being processed by another worker')
      return new NextResponse('Processing', { status: 202 })
    }

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
    // No filtrar detalles internos al caller (MP); solo un mensaje genérico.
    return new NextResponse('Webhook Error', { status: 500 })
  }
}
