/**
 * Hook para obtener detalles de deals de analytics
 */

import { useState, useEffect } from 'react'
import useSWR from 'swr'

interface DealDetail {
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
}

interface AnalyticsDealResponse {
  deals: DealDetail[]
  count: number
  period: {
    start: string
    end: string
    label: string
  }
}

export function useAnalyticsDealDetails(
  timeRange: string = '30d',
  type: string = 'all',
  sellerId?: string,
  enabled: boolean = true,
  date?: string,
  companyId?: string
) {
  const queryParams = new URLSearchParams()
  queryParams.set('timeRange', timeRange)
  queryParams.set('type', type)
  if (sellerId) queryParams.set('sellerId', sellerId)
  if (date) queryParams.set('date', date)
  if (companyId) queryParams.set('companyId', companyId)
  queryParams.set('_v', '2') // Cache buster estático para forzar bypass en Vercel CDN de respuestas cacheadas anteriores

  const { data, error, isLoading } = useSWR<AnalyticsDealResponse>(
    enabled ? `/api/analytics/deals?${queryParams.toString()}` : null,
    async (url: string) => {
      const res = await fetch(url)
      const payload = await res.json()
      
      if (!res.ok) {
        throw new Error(payload?.error?.message || 'Failed to fetch deal details')
      }
      
      if (payload?.success) {
        if (payload.data !== undefined) return payload.data
        throw new Error('Response format inválido: falta data')
      }
      if (payload?.deals !== undefined) {
        return payload
      }
      throw new Error(payload?.error?.message || 'Failed to fetch deal details')
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minuto
    }
  )

  return {
    deals: data?.deals,
    period: data?.period,
    count: data?.count ?? 0,
    isLoading,
    error,
  }
}
