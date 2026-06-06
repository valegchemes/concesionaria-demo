/**
 * Hook para obtener detalles de deals para los modales del dashboard de analíticas.
 * Usa /api/deals (endpoint probado y funcional) con filtros de fecha basados en updatedAt.
 */

'use client'

import useSWR from 'swr'
import { getDateRangeFromTimeRange } from './types'
import type { TimeRange } from './types'

export interface DealDetail {
  id: string
  unitCode: string
  sellerName: string
  sellerId: string
  finalPrice: number
  currency: string
  exchangeRate: number
  status: string
  deliveredAt: string
  createdAt: string
  buyerName?: string
  buyerPhone?: string
  unitModel?: string
  unitCostArs?: number
  unitCostUsd?: number
}

interface DealPeriod {
  start: string
  end: string
  label: string
}

function buildDateRange(timeRange: string, date?: string): { start: Date; end: Date; label: string } {
  if (date) {
    const selectedDate = new Date(date)
    const year = selectedDate.getUTCFullYear()
    const month = selectedDate.getUTCMonth()
    const day = selectedDate.getUTCDate()
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    const end = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999))
    return {
      start,
      end,
      label: selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    }
  }
  return getDateRangeFromTimeRange(timeRange as TimeRange)
}

// Fetcher genérico
const fetcher = async (url: string) => {
  const res = await fetch(url)
  const payload = await res.json()
  if (!res.ok) {
    const msg = typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message || `Error ${res.status}`
    throw new Error(msg)
  }
  return payload
}

export function useAnalyticsDealDetails(
  timeRange: string = '30d',
  _type: string = 'all',   // mantenemos el parámetro por compatibilidad, no se usa
  sellerId?: string,
  enabled: boolean = true,
  date?: string,
  _companyId?: string       // mantenemos el parámetro por compatibilidad, no se usa
) {
  const { start, end, label } = buildDateRange(timeRange, date)

  const params = new URLSearchParams()
  params.set('status', 'DELIVERED')
  params.set('limit', '200')
  params.set('updatedAtFrom', start.toISOString())
  params.set('updatedAtTo', end.toISOString())
  if (sellerId) params.set('soldById', sellerId)

  const swrKey = enabled ? `/api/deals?${params.toString()}` : null

  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // 2 minutos de deduplicación — los detalles de deals para modales no cambian frecuentemente
    dedupingInterval: 120000,
  })

  // paginatedResponse devuelve { success: true, data: [...], pagination: {...} }
  const deals: DealDetail[] | undefined = Array.isArray(data?.data)
    ? data.data.map((d: Record<string, unknown>) => {
        const unit = d.unit as Record<string, string> | undefined
        const seller = d.seller as Record<string, string> | undefined
        const lead = d.lead as Record<string, string> | undefined
        return {
          id: d.id as string,
          unitCode: unit?.title || unit?.vin || unit?.domain || 'N/A',
          sellerName: seller?.name || 'N/A',
          sellerId: (seller?.id || d.sellerId || '') as string,
          finalPrice: Number(d.finalPrice) || 0,
          currency: (d.finalPriceCurrency as string) || 'ARS',
          exchangeRate: Number(d.exchangeRate) || 1,
          status: d.status as string,
          deliveredAt: d.updatedAt ? new Date(d.updatedAt as string).toISOString() : new Date(d.createdAt as string).toISOString(),
          createdAt: new Date(d.createdAt as string).toISOString(),
          buyerName: lead?.name,
          buyerPhone: lead?.phone,
          unitModel: unit?.vin || unit?.domain || undefined,
          unitCostArs: unit?.acquisitionCostArs ? Number(unit.acquisitionCostArs) : undefined,
          unitCostUsd: unit?.acquisitionCostUsd ? Number(unit.acquisitionCostUsd) : undefined,
        }
      })
    : undefined

  const period: DealPeriod | undefined = data
    ? { start: start.toISOString(), end: end.toISOString(), label }
    : undefined

  return {
    deals,
    period,
    count: deals?.length ?? 0,
    isLoading,
    error,
  }
}
