'use client'

import useSWR from 'swr'

interface DashboardStats {
  leads: { total: number; active: number; new: number; lost: number }
  units: { total: number; available: number; sold: number; tradeInTotal: number; tradeInSold: number; pendingTradeIns: number }
  deals: { active: number; completed: number; canceled: number }
  notes: { collectedArs: number; pendingArs: number; overdueArs: number }
  sellerCommission: {
    commissionRate: number
    commissionArs: number
    commissionUsd: number
    pendingCommissionArs: number
    pendingCommissionUsd: number
  } | null
}

interface DashboardResponse {
  companyName?: string
  analyticsEnabled: boolean
  userRole: string
  stats: DashboardStats
}

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => {
  if (!d.success) throw new Error(d.error || 'Error al cargar dashboard')
  return d.data as DashboardResponse
})

const defaultStats: DashboardStats = {
  leads: { total: 0, active: 0, new: 0, lost: 0 },
  units: { total: 0, available: 0, sold: 0, tradeInTotal: 0, tradeInSold: 0, pendingTradeIns: 0 },
  deals: { active: 0, completed: 0, canceled: 0 },
  notes: { collectedArs: 0, pendingArs: 0, overdueArs: 0 },
  sellerCommission: null,
}

export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>(
    '/api/dashboard/stats',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30_000, // Refrescar cada 30s en segundo plano
      dedupingInterval: 10_000,
      errorRetryCount: 2,
    }
  )

  return {
    stats: data?.stats ?? defaultStats,
    companyName: data?.companyName,
    analyticsEnabled: data?.analyticsEnabled ?? false,
    userRole: data?.userRole ?? 'SELLER',
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  }
}
