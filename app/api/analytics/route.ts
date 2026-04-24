/**
 * Enterprise API Route: /api/analytics
 * - Runtime: Node.js Serverless
 * - Agregaciones SQL directas vía Prisma
 * - Aislamiento estricto por tenant (companyId)
 * - Usa updatedAt (no closedAt que puede ser null) para filtrado temporal
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/shared/prisma'
import { AnalyticsQuerySchema, getDateRangeFromTimeRange } from '@/lib/domains/analytics/types'
import { successResponse, errorResponse } from '@/lib/shared/api-response'
import { ValidationError, ForbiddenError, isAppError } from '@/lib/shared/errors'
import { createLogger } from '@/lib/shared/logger'
import type {
  DashboardSummary,
  SalesVsProfitAnalytics,
  TopSellersAnalytics,
  CostAnalysisAnalytics,
  TimeSeriesDataPoint,
  SellerPerformance,
  CostBreakdown,
  MoneyAmount,
  TimeRange
} from '@/lib/domains/analytics/types'
import { Prisma } from '@prisma/client'

const log = createLogger('API:Analytics')

interface AuthenticatedUser {
  userId: string
  companyId: string
  role: string
}

const EXCHANGE_RATE_ARS_PER_USD = 1000

function getAuthenticatedUser(request: NextRequest): AuthenticatedUser {
  const userId = request.headers.get('x-user-id')
  const companyId = request.headers.get('x-company-id')
  const role = request.headers.get('x-user-role')

  if (!userId || !companyId || !role) {
    log.error({}, 'Headers de autenticación faltantes')
    throw new ForbiddenError('Autenticación requerida')
  }

  return { userId, companyId, role }
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value.toString())
}

function createMoneyAmount(ars: number, usd: number): MoneyAmount {
  return {
    ars,
    usd,
    totalConverted: ars + (usd * EXCHANGE_RATE_ARS_PER_USD),
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const user = getAuthenticatedUser(request)
    log.info({ userId: user.userId, companyId: user.companyId }, 'GET /api/analytics - iniciado')

    const { searchParams } = new URL(request.url)
    const timeRangeParam = searchParams.get('timeRange') || '30d'
    const typeParam = searchParams.get('type') || 'dashboard'

    const validation = AnalyticsQuerySchema.safeParse({
      timeRange: timeRangeParam,
      currency: searchParams.get('currency') || 'BOTH',
    })

    if (!validation.success) {
      throw new ValidationError(
        'Parámetros de consulta inválidos',
        validation.error.flatten().fieldErrors
      )
    }

    const { timeRange } = validation.data
    const dateRange = getDateRangeFromTimeRange(timeRange)

    let result: unknown

    switch (typeParam) {
      case 'dashboard':
        result = await getDashboardSummary(user.companyId, timeRange, dateRange)
        break
      case 'sales-profit':
        result = await getSalesVsProfit(user.companyId, timeRange, dateRange)
        break
      case 'top-sellers':
        result = await getTopSellers(user.companyId, timeRange, dateRange)
        break
      case 'costs':
        result = await getCostAnalysis(user.companyId, timeRange, dateRange)
        break
      default:
        throw new ValidationError('Tipo de análisis no válido', {
          type: ['Valores permitidos: dashboard, sales-profit, top-sellers, costs']
        })
    }

    log.info(
      {
        userId: user.userId,
        companyId: user.companyId,
        type: typeParam,
        timeRange,
        duration: Date.now() - startTime
      },
      'GET /api/analytics - completado'
    )

    return successResponse(result)

  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      },
      'GET /api/analytics - error'
    )

    if (isAppError(error)) {
      return errorResponse(error, { path: '/api/analytics', method: 'GET' })
    }

    if (error instanceof ZodError) {
      return errorResponse(
        new ValidationError('Error de validación', error.flatten().fieldErrors),
        { path: '/api/analytics', method: 'GET' }
      )
    }

    return errorResponse(
      new Error('Error interno del servidor'),
      { path: '/api/analytics', method: 'GET' }
    )
  }
}

// ============================================================================
// FUNCIÓN: Dashboard Summary
// NOTA: Usa updatedAt para filtrar — closedAt puede ser null en deals antiguos
// ============================================================================

async function getDashboardSummary(
  companyId: string,
  timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<DashboardSummary> {
  const { start, end, label } = dateRange

  // Query 1: Deals completados con su unidad (para calcular costo de compra real)
  const dealsWithUnits = await prisma.deal.findMany({
    where: {
      companyId,
      status: { in: ['DELIVERED', 'APPROVED'] },
      updatedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      finalPrice: true,
      finalPriceCurrency: true,
      unit: {
        select: {
          acquisitionCostArs: true,
          acquisitionCostUsd: true,
        },
      },
    },
  })

  const totalDealCount = dealsWithUnits.length

  // Revenue: sumatoria de finalPrice (precio al cliente)
  const totalRevenue = dealsWithUnits.reduce((sum, d) => sum + decimalToNumber(d.finalPrice), 0)

  // Costo de compra: acquisitionCost de cada unidad vendida
  const totalAcquisitionCostArs = dealsWithUnits.reduce(
    (sum, d) => sum + decimalToNumber(d.unit?.acquisitionCostArs), 0
  )
  const totalAcquisitionCostUsd = dealsWithUnits.reduce(
    (sum, d) => sum + decimalToNumber(d.unit?.acquisitionCostUsd), 0
  )

  // Query 2: Costos adicionales de deals (comisiones, gastos de cierre)
  const dealIds = dealsWithUnits.map(d => d.id)
  const dealCosts = dealIds.length > 0
    ? await prisma.dealCostItem.aggregate({
        where: { dealId: { in: dealIds } },
        _sum: { amountArs: true, amountUsd: true },
      })
    : { _sum: { amountArs: null, amountUsd: null } }

  // Query 3: Costos adicionales de unidades (mantenimiento, reparaciones, etc.)
  const unitCosts = await prisma.unitCostItem.aggregate({
    where: {
      unit: {
        companyId,
        createdAt: { gte: start, lte: end },
      },
    },
    _sum: { amountArs: true, amountUsd: true },
  })

  // Query 4: Inventario actual
  const inventoryMetrics = await prisma.unit.groupBy({
    by: ['status'],
    where: { companyId, isActive: true },
    _count: { _all: true },
  })

  // Cálculo correcto de costos totales
  const totalCostsArs =
    totalAcquisitionCostArs +
    decimalToNumber(dealCosts._sum?.amountArs) +
    decimalToNumber(unitCosts._sum?.amountArs)

  const totalCostsUsd =
    totalAcquisitionCostUsd +
    decimalToNumber(dealCosts._sum?.amountUsd) +
    decimalToNumber(unitCosts._sum?.amountUsd)

  const totalCosts = createMoneyAmount(totalCostsArs, totalCostsUsd)
  const revenue = createMoneyAmount(totalRevenue, 0)

  // Ganancia neta = precio venta - costo compra - costos adicionales
  const netProfitArs = revenue.ars - totalCosts.totalConverted
  const netProfit = createMoneyAmount(Math.max(0, netProfitArs), 0)

  const inventoryMap = new Map(inventoryMetrics.map(item => [item.status, item._count._all]))
  const totalUnits = Array.from(inventoryMap.values()).reduce((a, b) => a + b, 0)

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      label,
    },
    kpis: {
      totalRevenue: revenue,
      netProfit,
      profitMargin: revenue.totalConverted > 0
        ? (netProfit.totalConverted / revenue.totalConverted) * 100
        : 0,
      totalDeals: totalDealCount,
      avgDealSize: totalDealCount > 0 ? revenue.totalConverted / totalDealCount : 0,
    },
    inventory: {
      totalUnits,
      soldUnits: inventoryMap.get('SOLD') || 0,
      availableUnits: inventoryMap.get('AVAILABLE') || 0,
      reservedUnits: inventoryMap.get('RESERVED') || 0,
      avgTimeToSell: 0,
    },
  }
}

// ============================================================================
// FUNCIÓN: Sales vs Profit (Time Series)
// ============================================================================

async function getSalesVsProfit(
  companyId: string,
  timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<SalesVsProfitAnalytics> {
  const { start, end } = dateRange

  // Traer todos los deals con su costo de adquisición
  const deals = await prisma.deal.findMany({
    where: {
      companyId,
      status: { in: ['DELIVERED', 'APPROVED'] },
      updatedAt: { gte: start, lte: end },
    },
    select: {
      finalPrice: true,
      updatedAt: true,
      unit: {
        select: {
          acquisitionCostArs: true,
          acquisitionCostUsd: true,
        },
      },
      closingCosts: {
        select: { amountArs: true, amountUsd: true },
      },
    },
  })

  // Agrupar por mes manualmente
  const byMonth = new Map<string, { sales: number; costs: number; count: number; date: Date }>()

  for (const deal of deals) {
    const d = deal.updatedAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = byMonth.get(key) || { sales: 0, costs: 0, count: 0, date: new Date(d.getFullYear(), d.getMonth(), 1) }

    const saleAmount = decimalToNumber(deal.finalPrice)
    const acquisitionArs = decimalToNumber(deal.unit?.acquisitionCostArs)
    const acquisitionUsd = decimalToNumber(deal.unit?.acquisitionCostUsd)
    const dealExtraCosts = deal.closingCosts.reduce(
      (sum, c) => sum + decimalToNumber(c.amountArs) + decimalToNumber(c.amountUsd) * EXCHANGE_RATE_ARS_PER_USD,
      0
    )
    const totalCostForDeal = acquisitionArs + (acquisitionUsd * EXCHANGE_RATE_ARS_PER_USD) + dealExtraCosts

    byMonth.set(key, {
      sales: existing.sales + saleAmount,
      costs: existing.costs + totalCostForDeal,
      count: existing.count + 1,
      date: existing.date,
    })
  }

  // Rellenar TODOS los meses del rango con ceros para que el gráfico nunca quede vacío
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth.has(key)) {
      byMonth.set(key, {
        sales: 0,
        costs: 0,
        count: 0,
        date: new Date(cursor.getFullYear(), cursor.getMonth(), 1),
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  // Ordenar por fecha
  const sortedKeys = Array.from(byMonth.keys()).sort()

  const timeSeries: TimeSeriesDataPoint[] = sortedKeys.map(key => {
    const entry = byMonth.get(key)!
    const profit = Math.max(0, entry.sales - entry.costs)

    return {
      date: entry.date.toISOString(),
      label: entry.date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
      sales: createMoneyAmount(entry.sales, 0),
      profit: createMoneyAmount(profit, 0),
      costs: createMoneyAmount(entry.costs, 0),
      dealCount: entry.count,
    }
  })

  const totals = timeSeries.reduce(
    (acc, point) => ({
      sales: createMoneyAmount(acc.sales.ars + point.sales.ars, 0),
      profit: createMoneyAmount(acc.profit.ars + point.profit.ars, 0),
      costs: createMoneyAmount(acc.costs.ars + point.costs.ars, 0),
      dealCount: acc.dealCount + point.dealCount,
    }),
    { sales: createMoneyAmount(0, 0), profit: createMoneyAmount(0, 0), costs: createMoneyAmount(0, 0), dealCount: 0 }
  )

  return {
    timeSeries,
    totals,
    trend: { salesGrowth: 0, profitGrowth: 0, costGrowth: 0 },
  }
}

// ============================================================================
// FUNCIÓN: Top Sellers
// ============================================================================

async function getTopSellers(
  companyId: string,
  timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<TopSellersAnalytics> {
  const { start, end } = dateRange

  const sellerStats = await prisma.deal.groupBy({
    by: ['sellerId'],
    where: {
      companyId,
      status: { in: ['DELIVERED', 'APPROVED'] },
      updatedAt: { gte: start, lte: end },
    },
    _sum: { finalPrice: true },
    _count: { _all: true },
  })

  const sellerIds = sellerStats.map(s => s.sellerId)
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds }, companyId },
    select: { id: true, name: true },
  })

  const sellerMap = new Map(sellers.map(s => [s.id, s.name]))

  const sellerPerformances: SellerPerformance[] = sellerStats.map(stat => {
    const totalSales = decimalToNumber(stat._sum?.finalPrice)
    const dealCount = stat._count._all

    return {
      sellerId: stat.sellerId,
      sellerName: sellerMap.get(stat.sellerId) || 'Unknown',
      totalSales: createMoneyAmount(totalSales, 0),
      dealCount,
      avgDealValue: dealCount > 0 ? totalSales / dealCount : 0,
      conversionRate: 0,
    }
  })

  sellerPerformances.sort((a, b) => b.totalSales.totalConverted - a.totalSales.totalConverted)

  const periodTotal = createMoneyAmount(
    sellerPerformances.reduce((sum, s) => sum + s.totalSales.ars, 0),
    0
  )

  return {
    sellers: sellerPerformances,
    periodTotal,
    topPerformer: sellerPerformances[0] || null,
  }
}

// ============================================================================
// FUNCIÓN: Cost Analysis
// ============================================================================

async function getCostAnalysis(
  companyId: string,
  timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<CostAnalysisAnalytics> {
  const { start, end } = dateRange

  // Costos de deals — sin filtro de fechas estricto para mostrar historial completo
  const dealCosts = await prisma.dealCostItem.findMany({
    where: {
      deal: {
        companyId,
        updatedAt: { gte: start, lte: end },
      },
    },
    select: { concept: true, amountArs: true, amountUsd: true },
  })

  // Costos de unidades en período
  const unitCosts = await prisma.unitCostItem.findMany({
    where: {
      unit: {
        companyId,
        createdAt: { gte: start, lte: end },
      },
    },
    select: { concept: true, amountArs: true, amountUsd: true },
  })

  const costsByConcept = new Map<string, MoneyAmount>()

  for (const cost of [...dealCosts, ...unitCosts]) {
    const existing = costsByConcept.get(cost.concept) || createMoneyAmount(0, 0)
    costsByConcept.set(cost.concept, createMoneyAmount(
      existing.ars + decimalToNumber(cost.amountArs),
      existing.usd + decimalToNumber(cost.amountUsd)
    ))
  }

  const totalCostsArs = Array.from(costsByConcept.values()).reduce((sum, c) => sum + c.ars, 0)
  const totalCostsUsd = Array.from(costsByConcept.values()).reduce((sum, c) => sum + c.usd, 0)
  const totalCosts = createMoneyAmount(totalCostsArs, totalCostsUsd)

  const breakdown: CostBreakdown[] = Array.from(costsByConcept.entries()).map(([category, amount]) => ({
    category,
    amount,
    percentage: totalCosts.totalConverted > 0
      ? (amount.totalConverted / totalCosts.totalConverted) * 100
      : 0,
  }))

  breakdown.sort((a, b) => b.amount.totalConverted - a.amount.totalConverted)

  return {
    breakdown,
    totalCosts,
    byType: {
      operational: createMoneyAmount(
        dealCosts.reduce((sum, c) => sum + decimalToNumber(c.amountArs), 0),
        dealCosts.reduce((sum, c) => sum + decimalToNumber(c.amountUsd), 0)
      ),
      maintenance: createMoneyAmount(
        unitCosts.reduce((sum, c) => sum + decimalToNumber(c.amountArs), 0),
        unitCosts.reduce((sum, c) => sum + decimalToNumber(c.amountUsd), 0)
      ),
      commissions: createMoneyAmount(0, 0),
    },
  }
}
