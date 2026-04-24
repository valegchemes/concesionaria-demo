/**
 * Enterprise API Route: /api/analytics
 * - Runtime: Edge (alto rendimiento)
 * - Agregaciones SQL directas vía Prisma
 * - Aislamiento estricto por tenant (companyId)
 * - Logging estructurado con Pino
 * - Caché implícita vía SWR en frontend
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/shared/prisma'
import { AnalyticsQuerySchema, TimeRangeEnum, getDateRangeFromTimeRange } from '@/lib/domains/analytics/types'
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

// ============================================================================
// TIPOS ESTRUCTURADOS (sin any)
// ============================================================================

interface AuthenticatedUser {
  userId: string
  companyId: string
  role: string
}

// ============================================================================
// EXCHANGE RATE (debería venir de configuración o API externa)
// ============================================================================

const EXCHANGE_RATE_ARS_PER_USD = 1000

// ============================================================================
// UTILIDADES DE AUTENTICACIÓN
// ============================================================================

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

// ============================================================================
// UTILIDADES DE CONVERSIÓN
// ============================================================================

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

// ============================================================================
// HANDLER PRINCIPAL: GET /api/analytics
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // 1. Autenticación y extracción de tenant
    const user = getAuthenticatedUser(request)
    log.info({ userId: user.userId, companyId: user.companyId }, 'GET /api/analytics - iniciado')

    // 2. Validación de query params con Zod
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

    // 3. Routing según tipo de análisis
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

    // Timeout handling para Edge Runtime
    if (error instanceof Error && error.message.includes('Timeout')) {
      return errorResponse(
        new ValidationError('La consulta excedió el tiempo máximo. Intenta con un rango de fechas más corto.'),
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
// ============================================================================

async function getDashboardSummary(
  companyId: string,
  timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<DashboardSummary> {
  const { start, end, label } = dateRange

  // Query 1: Métricas de ventas (AGREGACIÓN SQL DIRECTA)
  const salesMetrics = await prisma.deal.aggregate({
    where: {
      companyId, // 🔒 Tenant isolation
      status: { in: ['DELIVERED', 'APPROVED'] },
      closedAt: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      finalPrice: true,
    },
    _count: {
      _all: true,
    },
    _avg: {
      finalPrice: true,
    },
  })

  // Query 2: Costos totales (AGREGACIÓN SQL)
  const [dealCosts, unitCosts] = await Promise.all([
    prisma.dealCostItem.aggregate({
      where: {
        deal: {
          companyId, // 🔒 Tenant isolation
          closedAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        amountArs: true,
        amountUsd: true,
      },
    }),
    prisma.unitCostItem.aggregate({
      where: {
        unit: {
          companyId, // 🔒 Tenant isolation
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      },
      _sum: {
        amountArs: true,
        amountUsd: true,
      },
    }),
  ])

  // Query 3: Métricas de inventario
  const inventoryMetrics = await prisma.unit.groupBy({
    by: ['status'],
    where: {
      companyId, // 🔒 Tenant isolation
      isActive: true,
    },
    _count: {
      _all: true,
    },
  })

  // Cálculos seguros
  const totalRevenue = decimalToNumber(salesMetrics._sum?.finalPrice)
  const totalDealCount = salesMetrics._count?._all || 0
  
  const totalCostsArs = 
    decimalToNumber(dealCosts._sum?.amountArs) + 
    decimalToNumber(unitCosts._sum?.amountArs)
  const totalCostsUsd = 
    decimalToNumber(dealCosts._sum?.amountUsd) + 
    decimalToNumber(unitCosts._sum?.amountUsd)
  
  const totalCosts = createMoneyAmount(totalCostsArs, totalCostsUsd)
  const revenue = createMoneyAmount(totalRevenue, 0) // Assuming ARS for simplicity
  const netProfit = createMoneyAmount(
    Math.max(0, revenue.ars - totalCosts.ars),
    Math.max(0, revenue.usd - totalCosts.usd)
  )

  // Inventory breakdown
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
      avgTimeToSell: 0, // Requires more complex calculation
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

  // Agrupar por mes usando raw query para mejor performance
  const dealsByMonth = await prisma.$queryRaw<Array<{
    month: string
    year: number
    total_sales: Prisma.Decimal
    deal_count: bigint
  }>>`
    SELECT 
      EXTRACT(MONTH FROM "closedAt") as month,
      EXTRACT(YEAR FROM "closedAt") as year,
      SUM("finalPrice") as total_sales,
      COUNT(*) as deal_count
    FROM "Deal"
    WHERE "companyId" = ${companyId}
      AND "status" IN ('DELIVERED', 'APPROVED')
      AND "closedAt" >= ${start}
      AND "closedAt" <= ${end}
    GROUP BY EXTRACT(YEAR FROM "closedAt"), EXTRACT(MONTH FROM "closedAt")
    ORDER BY year, month
  `

  // Construir time series
  const timeSeries: TimeSeriesDataPoint[] = dealsByMonth.map(row => {
    const date = new Date(row.year, Number(row.month) - 1, 1)
    const sales = decimalToNumber(row.total_sales)
    
    return {
      date: date.toISOString(),
      label: date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }),
      sales: createMoneyAmount(sales, 0),
      profit: createMoneyAmount(sales * 0.15, 0), // 15% margin estimate
      costs: createMoneyAmount(sales * 0.85, 0),
      dealCount: Number(row.deal_count),
    }
  })

  // Totales
  const totals = timeSeries.reduce(
    (acc, point) => ({
      sales: createMoneyAmount(
        acc.sales.ars + point.sales.ars,
        acc.sales.usd + point.sales.usd
      ),
      profit: createMoneyAmount(
        acc.profit.ars + point.profit.ars,
        acc.profit.usd + point.profit.usd
      ),
      costs: createMoneyAmount(
        acc.costs.ars + point.costs.ars,
        acc.costs.usd + point.costs.usd
      ),
      dealCount: acc.dealCount + point.dealCount,
    }),
    {
      sales: createMoneyAmount(0, 0),
      profit: createMoneyAmount(0, 0),
      costs: createMoneyAmount(0, 0),
      dealCount: 0,
    }
  )

  return {
    timeSeries,
    totals,
    trend: {
      salesGrowth: 0, // Calculate vs previous period
      profitGrowth: 0,
      costGrowth: 0,
    },
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

  // Agregación por vendedor (SQL GROUP BY)
  const sellerStats = await prisma.deal.groupBy({
    by: ['sellerId'],
    where: {
      companyId, // 🔒 Tenant isolation
      status: { in: ['DELIVERED', 'APPROVED'] },
      closedAt: {
        gte: start,
        lte: end,
      },
    },
    _sum: {
      finalPrice: true,
    },
    _count: {
      _all: true,
    },
  })

  // Obtener nombres de vendedores
  const sellerIds = sellerStats.map(s => s.sellerId)
  const sellers = await prisma.user.findMany({
    where: {
      id: { in: sellerIds },
      companyId, // 🔒 Tenant isolation
    },
    select: {
      id: true,
      name: true,
    },
  })

  const sellerMap = new Map(sellers.map(s => [s.id, s.name]))

  // Construir ranking
  const sellerPerformances: SellerPerformance[] = sellerStats.map(stat => {
    const totalSales = decimalToNumber(stat._sum?.finalPrice)
    const dealCount = stat._count._all

    return {
      sellerId: stat.sellerId,
      sellerName: sellerMap.get(stat.sellerId) || 'Unknown',
      totalSales: createMoneyAmount(totalSales, 0),
      dealCount,
      avgDealValue: dealCount > 0 ? totalSales / dealCount : 0,
      conversionRate: 0, // Would require lead count
    }
  })

  // Ordenar por ventas totales
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

  // Costos de deals
  const dealCosts = await prisma.dealCostItem.findMany({
    where: {
      deal: {
        companyId, // 🔒 Tenant isolation
        closedAt: {
          gte: start,
          lte: end,
        },
      },
    },
    select: {
      concept: true,
      amountArs: true,
      amountUsd: true,
    },
  })

  // Costos de unidades
  const unitCosts = await prisma.unitCostItem.findMany({
    where: {
      unit: {
        companyId, // 🔒 Tenant isolation
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    },
    select: {
      concept: true,
      amountArs: true,
      amountUsd: true,
    },
  })

  // Agrupar por concepto
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

  // Construir breakdown
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
      commissions: createMoneyAmount(0, 0), // Calculate from deals
    },
  }
}
