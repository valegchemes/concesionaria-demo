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
import { kv } from '@vercel/kv'
import { prisma } from '@/lib/shared/prisma'
import { checkDatabaseConnection } from '@/lib/prisma'
import { getCurrentUser, getCurrentUserFromHeaders } from '@/lib/shared/auth-helpers'
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

/**
 * TTL de caché para analytics: 15 minutos.
 * Balance entre frescura de datos y protección de Neon DB.
 * Invalidar explícitamente si se necesitan datos en tiempo real.
 */
// Versión de caché. Incrementar esto invalida TODA la caché de analíticas
// Útil cuando se hacen cambios en la lógica de cálculo
const CACHE_VERSION = 'analytics:v6:'
const ANALYTICS_CACHE_TTL_SECONDS = 15 // Reducido a 15 segundos para mayor frescura
const ANALYTICS_TIMEOUT_MS = 8000 // 8 segundos máximo para computación

/**
 * Agrega headers para evitar que el navegador cachee la respuesta de la API.
 */
function addNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('Surrogate-Control', 'no-store')
  return response
}

/**
 * Construye la clave de caché única por tenant, tipo y rango temporal.
 */
function getAnalyticsCacheKey(companyId: string, type: string, timeRange: string): string {
  // CACHE_VERSION se usa como prefijo para invalidar todas las claves al hacer un bump de versión
  return `${CACHE_VERSION}${companyId}:${type}:${timeRange}`
}

/**
 * Wrapper con timeout para proteger contra queries que toman demasiado tiempo.
 * Si excede el timeout, rechaza con Error('ANALYTICS_TIMEOUT').
 */
function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`ANALYTICS_TIMEOUT:${context}`)), ms)
    ),
  ])
}

/**
 * Crea una respuesta fallback vacía pero estructuralmente válida.
 * Usado cuando analytics falla/timeout para no dejar la UI sin datos.
 */
function createFallbackResponse(type: string): unknown {
  const now = new Date().toISOString()
  const emptyMoney = { ars: 0, usd: 0, totalConverted: 0 }

  switch (type) {
    case 'dashboard':
      return {
        period: { start: now, end: now, label: 'fallback' },
        kpis: {
          totalRevenue: emptyMoney,
          netProfit: emptyMoney,
          profitMargin: 0,
          totalDeals: 0,
          avgDealSize: 0,
        },
        inventory: {
          totalUnits: 0,
          soldUnits: 0,
          availableUnits: 0,
          reservedUnits: 0,
          avgTimeToSell: 0,
        },
        _fallback: true,
        _message: 'Datos temporalmente no disponibles - intente en unos minutos',
      }
    case 'sales-profit':
      return {
        timeSeries: [],
        totals: { sales: emptyMoney, profit: emptyMoney, costs: emptyMoney, dealCount: 0 },
        trend: { salesGrowth: 0, profitGrowth: 0, costGrowth: 0 },
        _fallback: true,
      }
    case 'top-sellers':
      return {
        sellers: [],
        periodTotal: emptyMoney,
        topPerformer: null,
        _fallback: true,
      }
    case 'costs':
      return {
        breakdown: [],
        totalCosts: emptyMoney,
        byType: { operational: emptyMoney, maintenance: emptyMoney, commissions: emptyMoney },
        _fallback: true,
      }
    default:
      return { _fallback: true, _error: 'Tipo desconocido' }
  }
}

const DEFAULT_EXCHANGE_RATE_ARS_PER_USD = Number(
  process.env.DEFAULT_EXCHANGE_RATE_ARS_PER_USD ?? '1000'
)

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value.toString())
}

function resolveExchangeRate(exchangeRate?: Prisma.Decimal | null): number {
  const resolved = decimalToNumber(exchangeRate)
  return resolved > 0 ? resolved : DEFAULT_EXCHANGE_RATE_ARS_PER_USD
}

function createMoneyAmount(ars: number, usd: number, exchangeRate?: number): MoneyAmount {
  return {
    ars,
    usd,
    totalConverted: ars + (usd * (exchangeRate ?? DEFAULT_EXCHANGE_RATE_ARS_PER_USD)),
  }
}

function createExactMoneyAmount(ars: number, usd: number, totalConverted: number): MoneyAmount {
  return {
    ars,
    usd,
    totalConverted,
  }
}

function createDealRevenueAmount(deal: {
  finalPrice: Prisma.Decimal | null | undefined
  finalPriceCurrency?: string | null
  exchangeRate?: Prisma.Decimal | null
}): MoneyAmount {
  const finalPrice = decimalToNumber(deal.finalPrice)
  const currency = deal.finalPriceCurrency ?? 'ARS'
  const exchangeRate = resolveExchangeRate(deal.exchangeRate)

  return currency === 'USD'
    ? createMoneyAmount(0, finalPrice, exchangeRate)
    : createMoneyAmount(finalPrice, 0, exchangeRate)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
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

    // Intentar obtener usuario desde headers (rápido) o DB (lento)
    let user = null as null | { id: string; companyId: string; role?: string }
    try {
      user = await getCurrentUserFromHeaders(request)
    } catch (authErr) {
      log.warn({ error: String(authErr) }, 'Error extrayendo usuario de headers/DB')
    }

    const companyId = user?.companyId
    const userId = user?.id ?? 'unknown'

    if (!companyId) {
      log.warn({ userId, companyId }, 'No se pudo resolver companyId, devolviendo fallback')
      const fallback = createFallbackResponse(typeParam)
      const resp = successResponse(fallback)
      resp.headers.set('X-Cache', 'FALLBACK')
      resp.headers.set('X-Fallback-Reason', 'missing_company_id')
      return addNoCacheHeaders(resp)
    }

    // Comprobar conexión a la base de datos antes de ejecutar consultas pesadas
    const dbOk = await checkDatabaseConnection().catch((e) => {
      log.error({ error: String(e) }, 'checkDatabaseConnection() falló')
      return false
    })

    if (!dbOk) {
      log.warn({ companyId }, 'Base de datos no disponible — devolviendo fallback')
      const fallback = createFallbackResponse(typeParam)
      const resp = successResponse(fallback)
      resp.headers.set('X-Cache', 'FALLBACK')
      resp.headers.set('X-Fallback-Reason', 'db_unavailable')
      return addNoCacheHeaders(resp)
    }

    // ── Capa de caché (cache-aside pattern) ──────────────────────────────────
    // La clave incluye companyId para garantizar aislamiento de tenant.
    // VALID types guard para el switch a continuación.
    const validTypes = ['dashboard', 'sales-profit', 'top-sellers', 'costs']
    if (!validTypes.includes(typeParam)) {
      throw new ValidationError('Tipo de análisis no válido', {
        type: ['Valores permitidos: dashboard, sales-profit, top-sellers, costs']
      })
    }

    const cacheKey = getAnalyticsCacheKey(companyId, typeParam, timeRange)
    let cacheHit = false
    let result: unknown

    try {
      const cached = await kv.get<unknown>(cacheKey)
      if (cached !== null && cached !== undefined) {
        cacheHit = true
        result = cached
        log.debug({ cacheKey, type: typeParam }, 'Analytics cache HIT')
      }
    } catch (kvError) {
      // KV no disponible → fail-open, calculamos normalmente
      log.warn({ error: String(kvError) }, 'Analytics KV cache error — fallback to DB')
    }

    if (!cacheHit) {
      // Cache MISS: computar desde Neon DB con timeout protection
      // Si excede 8 segundos, fallback a respuesta vacía para proteger la UI
      try {
        switch (typeParam) {
          case 'dashboard':
            result = await withTimeout(
              getDashboardSummary(companyId, timeRange, dateRange),
              ANALYTICS_TIMEOUT_MS,
              'dashboard'
            )
            break
          case 'sales-profit':
            result = await withTimeout(
              getSalesVsProfit(companyId, timeRange, dateRange),
              ANALYTICS_TIMEOUT_MS,
              'sales-profit'
            )
            break
          case 'top-sellers':
            result = await withTimeout(
              getTopSellers(companyId, timeRange, dateRange),
              ANALYTICS_TIMEOUT_MS,
              'top-sellers'
            )
            break
          case 'costs':
            result = await withTimeout(
              getCostAnalysis(companyId, timeRange, dateRange),
              ANALYTICS_TIMEOUT_MS,
              'costs'
            )
            break
        }
      } catch (computeError) {
        // Timeout o error en computación → devolver fallback para no romper la UI
        const errorMsg = computeError instanceof Error ? computeError.message : String(computeError)
        const isTimeout = errorMsg.includes('ANALYTICS_TIMEOUT')

        log.warn(
          {
            companyId,
            userId,
            type: typeParam,
            timeRange,
            isTimeout,
            error: errorMsg,
            duration: Date.now() - startTime,
          },
          isTimeout ? 'Analytics computation TIMEOUT - returning fallback' : 'Analytics computation ERROR - returning fallback'
        )

        result = createFallbackResponse(typeParam)
        cacheHit = false // Marcar como no-cache para retry en próxima request

        // Devolver respuesta inmediatamente con header FALLBACK
        const fallbackResponse = successResponse(result)
        fallbackResponse.headers.set('X-Cache', 'FALLBACK')
        fallbackResponse.headers.set('X-Cache-TTL', '0')
        fallbackResponse.headers.set('X-Fallback-Reason', isTimeout ? 'timeout' : 'error')
        return addNoCacheHeaders(fallbackResponse)
      }

      // Guardar en KV de forma asíncrona (no bloquea la respuesta)
      try {
        kv.set(cacheKey, result, { ex: ANALYTICS_CACHE_TTL_SECONDS }).catch((err) => {
          log.warn({ error: String(err), cacheKey }, 'No se pudo guardar analytics en KV cache (async error)')
        })
      } catch (syncError) {
        // kv.set arroja un error sincrónico si faltan las variables de entorno de KV
        log.warn({ error: String(syncError), cacheKey }, 'No se pudo guardar analytics en KV cache (sync error)')
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const duration = Date.now() - startTime
    log.info(
      {
        userId,
        companyId,
        type: typeParam,
        timeRange,
        duration,
        cacheHit,
      },
      `GET /api/analytics - completado (${cacheHit ? 'CACHE HIT' : 'DB query'})`
    )

    const response = successResponse(result)
    // Header de observabilidad: permite ver en Vercel logs si se usó caché
    response.headers.set('X-Cache', cacheHit ? 'HIT' : 'MISS')
    response.headers.set('X-Cache-TTL', String(ANALYTICS_CACHE_TTL_SECONDS))
    return addNoCacheHeaders(response)

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

  // Para optimizar las consultas y evitar agotar el pool de Neon DB,
  // ejecutamos todo dentro de una única transacción (1 conexión)
  const [dealsWithUnits, unitCosts, inventoryMetrics, companyExpenses] = await prisma.$transaction([
    prisma.deal.findMany({
      where: {
        companyId,
        status: 'DELIVERED',
        updatedAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        finalPrice: true,
        finalPriceCurrency: true,
        exchangeRate: true,
        unit: {
          select: {
            acquisitionCostArs: true,
            acquisitionCostUsd: true,
          },
        },
      },
    }),
    prisma.unitCostItem.aggregate({
      where: {
        unit: { companyId },
        date: { gte: start, lte: end },
      },
      _sum: { amountArs: true, amountUsd: true },
    }),
    prisma.unit.groupBy({
      by: ['status'],
      where: { companyId, isActive: true },
      _count: { _all: true },
    }),
    prisma.companyExpense.aggregate({
      where: {
        companyId,
        isActive: true,
        date: { gte: start, lte: end },
      },
      _sum: { amountArs: true, amountUsd: true },
    }),
  ])

  const totalDealCount = dealsWithUnits.length

  const totalRevenue = dealsWithUnits.reduce(
    (acc, deal) => {
      const revenue = createDealRevenueAmount(deal)
      return createExactMoneyAmount(
        acc.ars + revenue.ars,
        acc.usd + revenue.usd,
        acc.totalConverted + revenue.totalConverted
      )
    },
    createExactMoneyAmount(0, 0, 0)
  )

  // Costo de compra: acquisitionCost de cada unidad vendida
  const totalAcquisitionCostArs = dealsWithUnits.reduce(
    (sum, d) => sum + decimalToNumber(d.unit?.acquisitionCostArs), 0
  )
  const totalAcquisitionCostUsd = dealsWithUnits.reduce(
    (sum, d) => sum + decimalToNumber(d.unit?.acquisitionCostUsd), 0
  )

  // Query 2: Costos adicionales de deals (comisiones, gastos de cierre)
  // Nota: Esto no se puede meter en la misma transacción inicial fácilmente porque depende de dealIds
  const dealIds = dealsWithUnits.map(d => d.id)
  const dealCosts = dealIds.length > 0
    ? await prisma.dealCostItem.aggregate({
      where: { dealId: { in: dealIds } },
      _sum: { amountArs: true, amountUsd: true },
    })
    : { _sum: { amountArs: null, amountUsd: null } }

  // Cálculo correcto de costos totales
  const totalCostsArs =
    totalAcquisitionCostArs +
    decimalToNumber(dealCosts._sum?.amountArs) +
    decimalToNumber(unitCosts._sum?.amountArs) +
    decimalToNumber(companyExpenses._sum?.amountArs)

  const totalCostsUsd =
    totalAcquisitionCostUsd +
    decimalToNumber(dealCosts._sum?.amountUsd) +
    decimalToNumber(unitCosts._sum?.amountUsd) +
    decimalToNumber(companyExpenses._sum?.amountUsd)

  const totalCosts = createMoneyAmount(totalCostsArs, totalCostsUsd)
  const revenue = totalRevenue

  const netProfit = createExactMoneyAmount(
    revenue.ars - totalCosts.ars,
    revenue.usd - totalCosts.usd,
    revenue.totalConverted - totalCosts.totalConverted
  )

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

  const deals = await prisma.deal.findMany({
    where: {
      companyId,
      status: 'DELIVERED',
      updatedAt: { gte: start, lte: end },
    },
    select: {
      finalPrice: true,
      finalPriceCurrency: true,
      exchangeRate: true,
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

  const isDaily = timeRange === '7d' || timeRange === '30d'
  const byPeriod = new Map<
    string,
    {
      salesArs: number
      salesUsd: number
      salesConverted: number
      unitCostsArs: number
      unitCostsUsd: number
      unitCostsConverted: number
      opCostsArs: number
      opCostsUsd: number
      opCostsConverted: number
      count: number
      date: Date
    }
  >()

  for (const deal of deals) {
    const d = deal.updatedAt
    const key = isDaily
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const existingDate = isDaily
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
      : new Date(d.getFullYear(), d.getMonth(), 1)

    const existing = byPeriod.get(key) || {
      salesArs: 0,
      salesUsd: 0,
      salesConverted: 0,
      unitCostsArs: 0,
      unitCostsUsd: 0,
      unitCostsConverted: 0,
      opCostsArs: 0,
      opCostsUsd: 0,
      opCostsConverted: 0,
      count: 0,
      date: existingDate,
    }

    const saleAmount = createDealRevenueAmount(deal)
    const acquisitionArs = decimalToNumber(deal.unit?.acquisitionCostArs)
    const acquisitionUsd = decimalToNumber(deal.unit?.acquisitionCostUsd)
    const extraCostsArs = deal.closingCosts.reduce(
      (sum, c) => sum + decimalToNumber(c.amountArs),
      0
    )
    const extraCostsUsd = deal.closingCosts.reduce(
      (sum, c) => sum + decimalToNumber(c.amountUsd),
      0
    )
    const totalCost = createMoneyAmount(
      acquisitionArs + extraCostsArs,
      acquisitionUsd + extraCostsUsd
    )

    byPeriod.set(key, {
      ...existing,
      salesArs: existing.salesArs + saleAmount.ars,
      salesUsd: existing.salesUsd + saleAmount.usd,
      salesConverted: existing.salesConverted + saleAmount.totalConverted,
      unitCostsArs: existing.unitCostsArs + acquisitionArs + extraCostsArs,
      unitCostsUsd: existing.unitCostsUsd + acquisitionUsd + extraCostsUsd,
      unitCostsConverted: existing.unitCostsConverted + totalCost.totalConverted,
      count: existing.count + 1,
    })
  }

  const companyExpenses = await prisma.companyExpense.findMany({
    where: {
      companyId,
      isActive: true,
      date: { gte: start, lte: end },
    },
    select: { amountArs: true, amountUsd: true, date: true },
  })

  const unitCosts = await prisma.unitCostItem.findMany({
    where: {
      date: { gte: start, lte: end },
      unit: { companyId },
    },
    select: { amountArs: true, amountUsd: true, date: true },
  })

  for (const exp of companyExpenses) {
    const d = exp.date
    const key = isDaily
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const existingDate = isDaily
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
      : new Date(d.getFullYear(), d.getMonth(), 1)

    const existing = byPeriod.get(key) || {
      salesArs: 0,
      salesUsd: 0,
      salesConverted: 0,
      unitCostsArs: 0,
      unitCostsUsd: 0,
      unitCostsConverted: 0,
      opCostsArs: 0,
      opCostsUsd: 0,
      opCostsConverted: 0,
      count: 0,
      date: existingDate,
    }

    const costArs = decimalToNumber(exp.amountArs)
    const costUsd = decimalToNumber(exp.amountUsd)
    const totalExpense = createMoneyAmount(costArs, costUsd)

    byPeriod.set(key, {
      ...existing,
      opCostsArs: existing.opCostsArs + costArs,
      opCostsUsd: existing.opCostsUsd + costUsd,
      opCostsConverted: existing.opCostsConverted + totalExpense.totalConverted,
    })
  }

  for (const uc of unitCosts) {
    const d = uc.date
    const key = isDaily
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const existingDate = isDaily
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate())
      : new Date(d.getFullYear(), d.getMonth(), 1)

    const existing = byPeriod.get(key) || {
      salesArs: 0,
      salesUsd: 0,
      salesConverted: 0,
      unitCostsArs: 0,
      unitCostsUsd: 0,
      unitCostsConverted: 0,
      opCostsArs: 0,
      opCostsUsd: 0,
      opCostsConverted: 0,
      count: 0,
      date: existingDate,
    }

    const costArs = decimalToNumber(uc.amountArs)
    const costUsd = decimalToNumber(uc.amountUsd)
    const totalCost = createMoneyAmount(costArs, costUsd)

    byPeriod.set(key, {
      ...existing,
      unitCostsArs: existing.unitCostsArs + costArs,
      unitCostsUsd: existing.unitCostsUsd + costUsd,
      unitCostsConverted: existing.unitCostsConverted + totalCost.totalConverted,
    })
  }

  const cursor = isDaily
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate())
    : new Date(start.getFullYear(), start.getMonth(), 1)

  const endPeriod = isDaily
    ? new Date(end.getFullYear(), end.getMonth(), end.getDate())
    : new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= endPeriod) {
    const key = isDaily
      ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      : `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`

    if (!byPeriod.has(key)) {
      byPeriod.set(key, {
        salesArs: 0,
        salesUsd: 0,
        salesConverted: 0,
        unitCostsArs: 0,
        unitCostsUsd: 0,
        unitCostsConverted: 0,
        opCostsArs: 0,
        opCostsUsd: 0,
        opCostsConverted: 0,
        count: 0,
        date: isDaily
          ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
          : new Date(cursor.getFullYear(), cursor.getMonth(), 1),
      })
    }

    if (isDaily) {
      cursor.setDate(cursor.getDate() + 1)
    } else {
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  const sortedKeys = Array.from(byPeriod.keys()).sort()

  let cumulativeSalesArs = 0
  let cumulativeSalesUsd = 0
  let cumulativeSalesConverted = 0
  
  let cumulativeUnitCostsArs = 0
  let cumulativeUnitCostsUsd = 0
  let cumulativeUnitCostsConverted = 0
  
  let cumulativeOpCostsArs = 0
  let cumulativeOpCostsUsd = 0
  let cumulativeOpCostsConverted = 0
  
  let cumulativeCount = 0

  const timeSeries: TimeSeriesDataPoint[] = sortedKeys.map(key => {
    const entry = byPeriod.get(key)!
    
    cumulativeSalesArs += entry.salesArs
    cumulativeSalesUsd += entry.salesUsd
    cumulativeSalesConverted += entry.salesConverted
    
    cumulativeUnitCostsArs += entry.unitCostsArs
    cumulativeUnitCostsUsd += entry.unitCostsUsd
    cumulativeUnitCostsConverted += entry.unitCostsConverted
    
    cumulativeOpCostsArs += entry.opCostsArs
    cumulativeOpCostsUsd += entry.opCostsUsd
    cumulativeOpCostsConverted += entry.opCostsConverted
    
    cumulativeCount += entry.count

    const totalCostsArs = cumulativeUnitCostsArs + cumulativeOpCostsArs
    const totalCostsUsd = cumulativeUnitCostsUsd + cumulativeOpCostsUsd
    const totalCostsConverted = cumulativeUnitCostsConverted + cumulativeOpCostsConverted

    const profitArs = cumulativeSalesArs - totalCostsArs
    const profitUsd = cumulativeSalesUsd - totalCostsUsd
    const profitConverted = cumulativeSalesConverted - totalCostsConverted

    const labelOptions: Intl.DateTimeFormatOptions = isDaily
      ? { day: 'numeric', month: 'short' }
      : { month: 'short', year: 'numeric' }

    return {
      date: entry.date.toISOString(),
      label: entry.date.toLocaleDateString('es-AR', labelOptions),
      sales: createExactMoneyAmount(cumulativeSalesArs, cumulativeSalesUsd, cumulativeSalesConverted),
      profit: createExactMoneyAmount(profitArs, profitUsd, profitConverted),
      costs: createExactMoneyAmount(totalCostsArs, totalCostsUsd, totalCostsConverted),
      unitCosts: createExactMoneyAmount(cumulativeUnitCostsArs, cumulativeUnitCostsUsd, cumulativeUnitCostsConverted),
      operationalCosts: createExactMoneyAmount(cumulativeOpCostsArs, cumulativeOpCostsUsd, cumulativeOpCostsConverted),
      dealCount: cumulativeCount,
    }
  })

  // Since timeSeries is now cumulative, the 'totals' is simply the last point
  // However, to maintain the exact same response structure and math logic:
  const totals = timeSeries.length > 0 ? {
    sales: timeSeries[timeSeries.length - 1].sales,
    profit: timeSeries[timeSeries.length - 1].profit,
    costs: timeSeries[timeSeries.length - 1].costs,
    unitCosts: timeSeries[timeSeries.length - 1].unitCosts,
    operationalCosts: timeSeries[timeSeries.length - 1].operationalCosts,
    dealCount: timeSeries[timeSeries.length - 1].dealCount,
  } : {
    sales: createExactMoneyAmount(0, 0, 0),
    profit: createExactMoneyAmount(0, 0, 0),
    costs: createExactMoneyAmount(0, 0, 0),
    unitCosts: createExactMoneyAmount(0, 0, 0),
    operationalCosts: createExactMoneyAmount(0, 0, 0),
    dealCount: 0,
  }


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
  _timeRange: TimeRange,
  dateRange: { start: Date; end: Date; label: string }
): Promise<TopSellersAnalytics> {
  const { start, end } = dateRange

  const deliveredDeals = await prisma.deal.findMany({
    where: {
      companyId,
      status: 'DELIVERED',
      updatedAt: { gte: start, lte: end },
    },
    select: {
      sellerId: true,
      finalPrice: true,
      finalPriceCurrency: true,
      exchangeRate: true,
    },
  })

  const sellerIds = Array.from(new Set(deliveredDeals.map(deal => deal.sellerId)))
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds }, companyId },
    select: { id: true, name: true },
  })

  const sellerMap = new Map(sellers.map(s => [s.id, s.name]))
  const metricsBySeller = new Map<
    string,
    { ars: number; usd: number; totalConverted: number; dealCount: number }
  >()

  for (const deal of deliveredDeals) {
    const revenue = createDealRevenueAmount(deal)
    const existing = metricsBySeller.get(deal.sellerId) || {
      ars: 0,
      usd: 0,
      totalConverted: 0,
      dealCount: 0,
    }

    metricsBySeller.set(deal.sellerId, {
      ars: existing.ars + revenue.ars,
      usd: existing.usd + revenue.usd,
      totalConverted: existing.totalConverted + revenue.totalConverted,
      dealCount: existing.dealCount + 1,
    })
  }

  const sellerPerformances: SellerPerformance[] = Array.from(metricsBySeller.entries()).map(
    ([sellerId, totals]) => ({
      sellerId,
      sellerName: sellerMap.get(sellerId) || 'Unknown',
      totalSales: createExactMoneyAmount(totals.ars, totals.usd, totals.totalConverted),
      dealCount: totals.dealCount,
      avgDealValue: totals.dealCount > 0 ? totals.totalConverted / totals.dealCount : 0,
      conversionRate: 0,
    })
  )

  sellerPerformances.sort((a, b) => b.totalSales.totalConverted - a.totalSales.totalConverted)

  const periodTotal = sellerPerformances.reduce(
    (acc, seller) =>
      createExactMoneyAmount(
        acc.ars + seller.totalSales.ars,
        acc.usd + seller.totalSales.usd,
        acc.totalConverted + seller.totalSales.totalConverted
      ),
    createExactMoneyAmount(0, 0, 0)
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

  // Gastos de la empresa (Costos mensuales)
  const companyExpenses = await prisma.companyExpense.findMany({
    where: {
      companyId,
      isActive: true,
      date: { gte: start, lte: end },
    },
    select: { category: true, amountArs: true, amountUsd: true },
  })

  const costsByConcept = new Map<string, MoneyAmount>()

  for (const cost of [...dealCosts, ...unitCosts]) {
    const existing = costsByConcept.get(cost.concept) || createMoneyAmount(0, 0)
    costsByConcept.set(cost.concept, createMoneyAmount(
      existing.ars + decimalToNumber(cost.amountArs),
      existing.usd + decimalToNumber(cost.amountUsd)
    ))
  }

  for (const exp of companyExpenses) {
    const existing = costsByConcept.get(exp.category) || createMoneyAmount(0, 0)
    costsByConcept.set(exp.category, createMoneyAmount(
      existing.ars + decimalToNumber(exp.amountArs),
      existing.usd + decimalToNumber(exp.amountUsd)
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
        dealCosts.reduce((sum, c) => sum + decimalToNumber(c.amountArs), 0) +
        companyExpenses.reduce((sum, e) => sum + decimalToNumber(e.amountArs), 0),
        dealCosts.reduce((sum, c) => sum + decimalToNumber(c.amountUsd), 0) +
        companyExpenses.reduce((sum, e) => sum + decimalToNumber(e.amountUsd), 0)
      ),
      maintenance: createMoneyAmount(
        unitCosts.reduce((sum, c) => sum + decimalToNumber(c.amountArs), 0),
        unitCosts.reduce((sum, c) => sum + decimalToNumber(c.amountUsd), 0)
      ),
      commissions: createMoneyAmount(0, 0),
    },
  }
}


