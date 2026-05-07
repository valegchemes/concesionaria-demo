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
  date?: string
) {
  const queryParams = new URLSearchParams()
  queryParams.set('timeRange', timeRange)
  queryParams.set('type', type)
  if (sellerId) queryParams.set('sellerId', sellerId)
  if (date) queryParams.set('date', date)

  const { data, error, isLoading } = useSWR<AnalyticsDealResponse>(
    enabled ? `/api/analytics/deals?${queryParams.toString()}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch deal details')
      return res.json()
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
