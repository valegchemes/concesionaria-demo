/**
 * Hooks React para Analíticas con SWR
 * - Caché de 5 minutos (300000 ms)
 * - Revalidación automática
 * - Manejo de errores tipado
 * - Sin 'any'
 */

'use client'

import useSWR, { SWRConfiguration } from 'swr'
import { useMemo } from 'react'
import type { 
  DashboardSummary, 
  SalesVsProfitAnalytics, 
  TopSellersAnalytics, 
  CostAnalysisAnalytics,
  TimeRange,
  AnalyticsError,
  TimeSeriesDataPoint,
  SellerPerformance,
  CostBreakdown
} from './types'
import { analyticsCacheKeys } from './types'

// ============================================================================
// Configuración Global de SWR
// ============================================================================

const ANALYTICS_CACHE_TIME_MS = 5 * 60 * 1000 // 5 minutos

const swrConfig: SWRConfiguration = {
  refreshInterval: ANALYTICS_CACHE_TIME_MS,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000, // 5 segundos de deduplicación
  errorRetryCount: 3,
  errorRetryInterval: 3000,
}

// ============================================================================
// Fetcher tipado para API
// ============================================================================

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
  }
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiResponse<T> = await response.json().catch(() => ({
      success: false,
      error: { message: 'Error desconocido' },
    }))
    
    throw new Error(
      errorData.error?.message || `Error ${response.status}: ${response.statusText}`
    )
  }

  const data: ApiResponse<T> = await response.json()
  
  if (!data.success || data.data === undefined) {
    throw new Error(data.error?.message || 'Error en la respuesta del servidor')
  }

  return data.data
}

// ============================================================================
// Hook: Dashboard Summary
// ============================================================================

interface UseDashboardAnalyticsReturn {
  summary: DashboardSummary | undefined
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  mutate: () => Promise<DashboardSummary | undefined>
}

export function useDashboardAnalytics(
  timeRange: TimeRange,
  companyId: string | undefined
): UseDashboardAnalyticsReturn {
  const cacheKey = companyId 
    ? analyticsCacheKeys.dashboard(companyId, timeRange)
    : null

  const { data, error, mutate, isLoading } = useSWR<DashboardSummary>(
    cacheKey ? `/api/analytics?type=dashboard&timeRange=${timeRange}` : null,
    fetcher,
    swrConfig
  )

  return {
    summary: data,
    isLoading,
    isError: !!error,
    error: error || undefined,
    mutate,
  }
}

// ============================================================================
// Hook: Sales vs Profit
// ============================================================================

interface UseSalesProfitAnalyticsReturn {
  analytics: SalesVsProfitAnalytics | undefined
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  chartData: Array<{
    name: string
    sales: number
    profit: number
    costs: number
  }>
}

export function useSalesProfitAnalytics(
  timeRange: TimeRange,
  companyId: string | undefined
): UseSalesProfitAnalyticsReturn {
  const cacheKey = companyId
    ? analyticsCacheKeys.salesProfit(companyId, timeRange)
    : null

  const { data, error, isLoading } = useSWR<SalesVsProfitAnalytics>(
    cacheKey ? `/api/analytics?type=sales-profit&timeRange=${timeRange}` : null,
    fetcher,
    swrConfig
  )

  // Transformar datos para Recharts
  const chartData = useMemo(() => {
    if (!data?.timeSeries) return []
    
    return data.timeSeries.map((point: TimeSeriesDataPoint) => ({
      name: point.label,
      sales: point.sales.totalConverted,
      profit: point.profit.totalConverted,
      costs: point.costs.totalConverted,
    }))
  }, [data])

  return {
    analytics: data,
    isLoading,
    isError: !!error,
    error: error || undefined,
    chartData,
  }
}

// ============================================================================
// Hook: Top Sellers
// ============================================================================

interface UseTopSellersReturn {
  analytics: TopSellersAnalytics | undefined
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  chartData: Array<{
    name: string
    sales: number
    deals: number
  }>
}

export function useTopSellers(
  timeRange: TimeRange,
  companyId: string | undefined
): UseTopSellersReturn {
  const cacheKey = companyId
    ? analyticsCacheKeys.topSellers(companyId, timeRange)
    : null

  const { data, error, isLoading } = useSWR<TopSellersAnalytics>(
    cacheKey ? `/api/analytics?type=top-sellers&timeRange=${timeRange}` : null,
    fetcher,
    swrConfig
  )

  // Transformar datos para Recharts (BarChart horizontal)
  const chartData = useMemo(() => {
    if (!data?.sellers) return []
    
    return data.sellers.map((seller: SellerPerformance) => ({
      name: seller.sellerName.split(' ')[0], // First name only for brevity
      sales: seller.totalSales.totalConverted,
      deals: seller.dealCount,
    }))
  }, [data])

  return {
    analytics: data,
    isLoading,
    isError: !!error,
    error: error || undefined,
    chartData,
  }
}

// ============================================================================
// Hook: Cost Analysis
// ============================================================================

interface UseCostAnalysisReturn {
  analytics: CostAnalysisAnalytics | undefined
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  pieData: Array<{
    name: string
    value: number
    percentage: number
  }>
}

export function useCostAnalysis(
  timeRange: TimeRange,
  companyId: string | undefined
): UseCostAnalysisReturn {
  const cacheKey = companyId
    ? analyticsCacheKeys.costs(companyId, timeRange)
    : null

  const { data, error, isLoading } = useSWR<CostAnalysisAnalytics>(
    cacheKey ? `/api/analytics?type=costs&timeRange=${timeRange}` : null,
    fetcher,
    swrConfig
  )

  // Transformar datos para DonutChart
  const pieData = useMemo(() => {
    if (!data?.breakdown) return []
    
    return data.breakdown.map((item: CostBreakdown) => ({
      name: item.category,
      value: item.amount.totalConverted,
      percentage: item.percentage,
    }))
  }, [data])

  return {
    analytics: data,
    isLoading,
    isError: !!error,
    error: error || undefined,
    pieData,
  }
}

// ============================================================================
// Hook: Todas las métricas (para prefetch)
// ============================================================================

interface UseAllAnalyticsReturn {
  dashboard: ReturnType<typeof useDashboardAnalytics>
  salesProfit: ReturnType<typeof useSalesProfitAnalytics>
  topSellers: ReturnType<typeof useTopSellers>
  costs: ReturnType<typeof useCostAnalysis>
  isLoadingAny: boolean
  hasError: boolean
}

export function useAllAnalytics(
  timeRange: TimeRange,
  companyId: string | undefined
): UseAllAnalyticsReturn {
  const dashboard = useDashboardAnalytics(timeRange, companyId)
  const salesProfit = useSalesProfitAnalytics(timeRange, companyId)
  const topSellers = useTopSellers(timeRange, companyId)
  const costs = useCostAnalysis(timeRange, companyId)

  const isLoadingAny = dashboard.isLoading || salesProfit.isLoading || topSellers.isLoading || costs.isLoading
  const hasError = dashboard.isError || salesProfit.isError || topSellers.isError || costs.isError

  return {
    dashboard,
    salesProfit,
    topSellers,
    costs,
    isLoadingAny,
    hasError,
  }
}

// ============================================================================
// Hook: Selector de rango de tiempo
// ============================================================================

interface UseTimeRangeReturn {
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  options: Array<{ value: TimeRange; label: string }>
}

import { useState } from 'react'

export function useTimeRange(defaultRange: TimeRange = '30d'): UseTimeRangeReturn {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultRange)

  const options = useMemo(() => [
    { value: '7d' as TimeRange, label: 'Últimos 7 días' },
    { value: '30d' as TimeRange, label: 'Últimos 30 días' },
    { value: '90d' as TimeRange, label: 'Últimos 90 días' },
    { value: '1y' as TimeRange, label: 'Último año' },
    { value: 'all' as TimeRange, label: 'Todo el historial' },
  ], [])

  return {
    timeRange,
    setTimeRange,
    options,
  }
}

// ============================================================================
// Funciones de utilidad para formateo
// ============================================================================

export function formatCurrency(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  
  return formatter.format(value)
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value)
}
