/**
 * lib/shared/realtime.ts
 * Pusher backend singleton para broadcasting de eventos en tiempo real.
 * 
 * Patrón: Fail-safe — si las credenciales de Pusher no están configuradas,
 * el broadcast se omite silenciosamente sin romper la operación principal.
 * 
 * Canales: private-company-{companyId}  (aislamiento multi-tenant)
 * Eventos: deal.created | deal.updated | deal.deleted
 */

import Pusher from 'pusher'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('Realtime')

// ============================================================================
// TIPOS DE EVENTOS
// ============================================================================

export type DealEventName = 'deal.created' | 'deal.updated' | 'deal.deleted'

export interface DealRealtimePayload {
  id: string
  status?: string
  finalPrice?: number
  finalPriceCurrency?: string
  createdAt?: string
  updatedAt?: string
  lead?: { name: string; phone: string }
  unit?: { title: string; type: string }
  seller?: { name: string }
  triggeredBy?: string // userId del usuario que disparó el evento
}

export interface RealtimeEvent<T = unknown> {
  event: string
  payload: T
  timestamp: string
}

// ============================================================================
// SINGLETON DE PUSHER (BACKEND)
// ============================================================================

const globalForPusher = global as unknown as { pusherServer: Pusher | null | undefined }

function createPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER ?? 'us2'

  if (!appId || !key || !secret) {
    log.warn({}, 'Pusher credentials not configured — realtime broadcasting disabled')
    return null
  }

  return new Pusher({ appId, key, secret, cluster, useTLS: true })
}

function getPusherServer(): Pusher | null {
  if (globalForPusher.pusherServer === undefined) {
    globalForPusher.pusherServer = createPusherServer()
  }
  return globalForPusher.pusherServer
}

// ============================================================================
// HELPERS PÚBLICOS
// ============================================================================

/**
 * Emite un evento de Deal al canal privado de la empresa.
 * Fail-safe: si Pusher no está configurado, retorna silenciosamente.
 */
export async function broadcastDealEvent(
  companyId: string,
  eventName: DealEventName,
  payload: DealRealtimePayload
): Promise<void> {
  const pusher = getPusherServer()
  if (!pusher) return

  const channel = `private-company-${companyId}`
  const envelope: RealtimeEvent<DealRealtimePayload> = {
    event: eventName,
    payload,
    timestamp: new Date().toISOString(),
  }

  try {
    await pusher.trigger(channel, eventName, envelope)
    log.debug({ channel, eventName, dealId: payload.id }, 'Realtime event broadcasted')
  } catch (err) {
    // No bloquear la respuesta HTTP si Pusher falla
    log.error(
      { error: err instanceof Error ? err.message : String(err), channel, eventName },
      'Failed to broadcast realtime event'
    )
  }
}

/**
 * Emite un evento genérico a un canal de empresa.
 * Útil para otros módulos (leads, inventory, etc.) en el futuro.
 */
export async function broadcastCompanyEvent(
  companyId: string,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  const pusher = getPusherServer()
  if (!pusher) return

  const channel = `private-company-${companyId}`
  try {
    await pusher.trigger(channel, eventName, {
      event: eventName,
      payload,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err), channel, eventName },
      'Failed to broadcast company event'
    )
  }
}

/**
 * Construye el payload de Deal desde el objeto retornado por dealService.
 * Normaliza la data para que el cliente siempre reciba la misma forma.
 */
export function buildDealPayload(
  deal: Record<string, unknown>,
  triggeredBy?: string
): DealRealtimePayload {
  return {
    id: deal.id as string,
    status: deal.status as string | undefined,
    finalPrice: deal.finalPrice != null ? Number(deal.finalPrice) : undefined,
    finalPriceCurrency: deal.finalPriceCurrency as string | undefined,
    createdAt: deal.createdAt instanceof Date
      ? deal.createdAt.toISOString()
      : deal.createdAt as string | undefined,
    updatedAt: deal.updatedAt instanceof Date
      ? deal.updatedAt.toISOString()
      : deal.updatedAt as string | undefined,
    lead: deal.lead as { name: string; phone: string } | undefined,
    unit: deal.unit as { title: string; type: string } | undefined,
    seller: deal.seller as { name: string } | undefined,
    triggeredBy,
  }
}
