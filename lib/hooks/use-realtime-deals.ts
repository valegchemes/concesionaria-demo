/**
 * lib/hooks/use-realtime-deals.ts
 * Hook de React para suscribirse a eventos de Deals en tiempo real (Pusher).
 * 
 * Uso:
 *   const { isConnected } = useRealtimeDeals({
 *     companyId,
 *     onDealUpdated: (payload) => { ... },
 *     onDealCreated: (payload) => { ... },
 *     onDealDeleted: (payload) => { ... },
 *   })
 * 
 * Características:
 * - Lazy initialization: el cliente Pusher se instancia solo en el browser
 * - Auto-cleanup: se desconecta cuando el componente se desmonta
 * - Graceful degradation: si las env vars no están, simplemente no hace nada
 * - Filtra los eventos propios del usuario (evita doble-actualización con optimistic UI)
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DealRealtimePayload, RealtimeEvent } from '@/lib/shared/realtime'

export type { DealRealtimePayload }

export interface UseRealtimeDealsOptions {
  /** ID de la empresa actual (multi-tenant channel) */
  companyId: string | undefined
  /** ID del usuario actual para filtrar eventos propios */
  currentUserId?: string
  /** Callbacks de eventos */
  onDealUpdated?: (payload: DealRealtimePayload) => void
  onDealCreated?: (payload: DealRealtimePayload) => void
  onDealDeleted?: (payload: DealRealtimePayload) => void
}

export interface UseRealtimeDealsReturn {
  isConnected: boolean
  lastEvent: DealRealtimePayload | null
}

// Tipo mínimo para tipado de PusherJS sin importar el módulo completo en SSR
interface PusherChannel {
  bind(event: string, callback: (data: unknown) => void): void
  unbind_all(): void
}

interface PusherInstance {
  subscribe(channelName: string): PusherChannel
  unsubscribe(channelName: string): void
  disconnect(): void
  connection: {
    bind(event: string, callback: () => void): void
    unbind_all(): void
    state: string
  }
}

export function useRealtimeDeals({
  companyId,
  currentUserId,
  onDealUpdated,
  onDealCreated,
  onDealDeleted,
}: UseRealtimeDealsOptions): UseRealtimeDealsReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<DealRealtimePayload | null>(null)

  const pusherRef = useRef<PusherInstance | null>(null)
  const channelRef = useRef<PusherChannel | null>(null)

  // Estabilizar los callbacks con useCallback para evitar re-suscripciones innecesarias
  const handleUpdated = useCallback(
    (payload: DealRealtimePayload) => {
      // Filtrar eventos que YO mismo disparé (ya aplicamos optimistic update)
      if (currentUserId && payload.triggeredBy === currentUserId) return
      setLastEvent(payload)
      onDealUpdated?.(payload)
    },
     
    [currentUserId, onDealUpdated]
  )

  const handleCreated = useCallback(
    (payload: DealRealtimePayload) => {
      if (currentUserId && payload.triggeredBy === currentUserId) return
      setLastEvent(payload)
      onDealCreated?.(payload)
    },
     
    [currentUserId, onDealCreated]
  )

  const handleDeleted = useCallback(
    (payload: DealRealtimePayload) => {
      if (currentUserId && payload.triggeredBy === currentUserId) return
      setLastEvent(payload)
      onDealDeleted?.(payload)
    },
     
    [currentUserId, onDealDeleted]
  )

  useEffect(() => {
    if (!companyId) return

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'us2'

    // Si no están configuradas las vars públicas, no hacer nada
    if (!pusherKey) return

    let isMounted = true

    // Importación dinámica para evitar problemas de SSR
    import('pusher-js').then(({ default: PusherJS }) => {
      if (!isMounted) return

      const pusher = new PusherJS(pusherKey, {
        cluster: pusherCluster,
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      }) as unknown as PusherInstance

      pusherRef.current = pusher

      // Monitor de conexión
      pusher.connection.bind('connected', () => {
        if (isMounted) setIsConnected(true)
      })

      pusher.connection.bind('disconnected', () => {
        if (isMounted) setIsConnected(false)
      })

      pusher.connection.bind('failed', () => {
        if (isMounted) setIsConnected(false)
      })

      // Suscribirse al canal privado de la empresa
      const channel = pusher.subscribe(`private-company-${companyId}`)
      channelRef.current = channel

      // Bind de eventos — el envelope es RealtimeEvent<DealRealtimePayload>
      channel.bind('deal.updated', (envelope: unknown) => {
        const data = envelope as RealtimeEvent<DealRealtimePayload>
        handleUpdated(data.payload)
      })

      channel.bind('deal.created', (envelope: unknown) => {
        const data = envelope as RealtimeEvent<DealRealtimePayload>
        handleCreated(data.payload)
      })

      channel.bind('deal.deleted', (envelope: unknown) => {
        const data = envelope as RealtimeEvent<DealRealtimePayload>
        handleDeleted(data.payload)
      })
    })

    return () => {
      isMounted = false
      if (channelRef.current) {
        channelRef.current.unbind_all()
      }
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`private-company-${companyId}`)
        pusherRef.current.disconnect()
        pusherRef.current = null
      }
      setIsConnected(false)
    }
  }, [companyId]) // Solo re-suscribir si cambia la empresa

  // Re-bindear callbacks cuando cambian (sin reconectar)
   
  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    channel.unbind_all()
    channel.bind('deal.updated', (envelope: unknown) => {
      const data = envelope as RealtimeEvent<DealRealtimePayload>
      handleUpdated(data.payload)
    })
    channel.bind('deal.created', (envelope: unknown) => {
      const data = envelope as RealtimeEvent<DealRealtimePayload>
      handleCreated(data.payload)
    })
    channel.bind('deal.deleted', (envelope: unknown) => {
      const data = envelope as RealtimeEvent<DealRealtimePayload>
      handleDeleted(data.payload)
    })
  }, [handleUpdated, handleCreated, handleDeleted])

  return { isConnected, lastEvent }
}
