/**
 * Tipos estrictos para el Módulo de Analíticas
 * Sin uso de 'any' - Enterprise Grade
 */

import { z } from 'zod'
import type { Decimal } from '@prisma/client/runtime/library'

// ============================================================================
// Enums y Schemas Zod
// ============================================================================

export const TimeRangeEnum = z.enum(['7d', '30d', '90d', '1y', 'all'])
export const CurrencyEnum = z.enum(['ARS', 'USD', 'BOTH'])

export const AnalyticsQuerySchema = z.object({
  timeRange: TimeRangeEnum.default('30d'),
  currency: CurrencyEnum.default('BOTH'),
  includeCosts: z.boolean().default(true),
})

// ============================================================================
// Tipos Base (sin any)
// ============================================================================

export type TimeRange = z.infer<typeof TimeRangeEnum>
export type AnalyticsCurrency = z.infer<typeof CurrencyEnum>
export type AnalyticsQueryParams = z.infer<typeof AnalyticsQuerySchema>

export interface MoneyAmount {
  ars: number
  usd: number
  totalConverted: number // En ARS usando tipo de cambio
}

export interface TimeSeriesDataPoint {
  date: string // ISO date
  label: string // Formatted date (e.g., "Ene 2024")
  sales: MoneyAmount
  profit: MoneyAmount
  costs: MoneyAmount
  dealCount: number
}

export interface SellerPerformance {
  sellerId: string
  sellerName: string
  totalSales: MoneyAmount
  dealCount: number
  avgDealValue: number
  conversionRate: number // Percentage
}

export interface CostBreakdown {
  category: string
  amount: MoneyAmount
  percentage: number
}

export interface UnitMetrics {
  totalUnits: number
  soldUnits: number
  availableUnits: number
  reservedUnits: number
  avgTimeToSell: number // Days
}

// ============================================================================
// Respuestas de API
// ============================================================================

export interface SalesVsProfitAnalytics {
  timeSeries: TimeSeriesDataPoint[]
  totals: {
    sales: MoneyAmount
    profit: MoneyAmount
    costs: MoneyAmount
    dealCount: number
  }
  trend: {
    salesGrowth: number // Percentage vs previous period
    profitGrowth: number
    costGrowth: number
  }
}

export interface TopSellersAnalytics {
  sellers: SellerPerformance[]
  periodTotal: MoneyAmount
  topPerformer: SellerPerformance | null
}

export interface CostAnalysisAnalytics {
  breakdown: CostBreakdown[]
  totalCosts: MoneyAmount
  byType: {
    operational: MoneyAmount
    maintenance: MoneyAmount
    commissions: MoneyAmount
  }
}

export interface DashboardSummary {
  period: {
    start: string
    end: string
    label: string
  }
  kpis: {
    totalRevenue: MoneyAmount
    netProfit: MoneyAmount
    profitMargin: number
    totalDeals: number
    avgDealSize: number
  }
  inventory: UnitMetrics
}

// ============================================================================
// Tipos para Recharts (con tipado estricto)
// ============================================================================

export interface ChartDataPoint {
  name: string
  value: number
  ars?: number
  usd?: number
  fill?: string
}

export interface StackedChartDataPoint {
  name: string
  salesArs: number
  salesUsd: number
  profitArs: number
  profitUsd: number
  costsArs: number
  costsUsd: number
}

// ============================================================================
// Filtros y Queries
// ============================================================================

export interface AnalyticsFilters {
  companyId: string
  timeRange: TimeRange
  startDate: Date
  endDate: Date
  currency: AnalyticsCurrency
}

export interface PrismaAggregateResult {
  _sum: {
    finalPrice: Decimal | null
    depositAmount: Decimal | null
  }
  _count: {
    _all: number
  }
  _avg: {
    finalPrice: Decimal | null
  }
}

// ============================================================================
// Errores Específicos
// ============================================================================

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_DATE_RANGE' | 'MISSING_TENANT' | 'AGGREGATION_FAILED' | 'TIMEOUT',
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AnalyticsError'
  }
}

// ============================================================================
// Cache Keys para SWR
// ============================================================================

export const analyticsCacheKeys = {
  dashboard: (companyId: string, timeRange: TimeRange) => 
    `analytics-dashboard-${companyId}-${timeRange}`,
  salesProfit: (companyId: string, timeRange: TimeRange) => 
    `analytics-sales-profit-${companyId}-${timeRange}`,
  topSellers: (companyId: string, timeRange: TimeRange) => 
    `analytics-top-sellers-${companyId}-${timeRange}`,
  costs: (companyId: string, timeRange: TimeRange) => 
    `analytics-costs-${companyId}-${timeRange}`,
} as const

// ============================================================================
// Utilidades de Fechas
// ============================================================================

export function getDateRangeFromTimeRange(timeRange: TimeRange): { start: Date; end: Date; label: string } {
  const now = new Date()
  // Establecer el final del día actual para incluir registros de hoy
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  
  switch (timeRange) {
    case '7d':
      start.setDate(end.getDate() - 7)
      return { start, end, label: 'Últimos 7 días' }
    case '30d':
      start.setDate(end.getDate() - 30)
      return { start, end, label: 'Últimos 30 días' }
    case '90d':
      start.setDate(end.getDate() - 90)
      return { start, end, label: 'Últimos 90 días' }
    case '1y':
      start.setFullYear(end.getFullYear() - 1)
      return { start, end, label: 'Último año' }
    case 'all':
      start.setFullYear(2000) // Arbitrary far past date
      return { start, end, label: 'Todo el historial' }
    default:
      const exhaustiveCheck: never = timeRange
      throw new Error(`Invalid timeRange: ${exhaustiveCheck}`)
  }
}

// ============================================================================
// Helper: Convertir Decimal a número seguro
// ============================================================================

export function decimalToNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value.toString())
}

// ============================================================================
// Helper: Calcular conversión ARS/USD
// ============================================================================

const DEFAULT_EXCHANGE_RATE = 1000 // ARS per USD - should be configurable

export function calculateTotalInARS(arsAmount: number, usdAmount: number, exchangeRate: number = DEFAULT_EXCHANGE_RATE): number {
  return arsAmount + (usdAmount * exchangeRate)
}

export function createMoneyAmount(ars: number, usd: number, exchangeRate?: number): MoneyAmount {
  return {
    ars,
    usd,
    totalConverted: calculateTotalInARS(ars, usd, exchangeRate),
  }
}
