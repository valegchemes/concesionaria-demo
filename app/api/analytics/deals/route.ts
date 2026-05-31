/**
 * API Route: /api/analytics/deals
 * - Devuelve detalles completos de deals para un rango de fechas
 * - Usado por modales de detalle en dashboard
 * - Filtrado por timeRange y tipo de métrica
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { createLogger } from '@/lib/shared/logger'
import { getDateRangeFromTimeRange } from '@/lib/domains/analytics/types'
import { successResponse, errorResponse } from '@/lib/shared/api-response'
import { ValidationError } from '@/lib/shared/errors'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const log = createLogger('API:Analytics:Deals')

export const maxDuration = 30

const QuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y', 'all', 'this_month']).default('30d'),
  type: z.enum(['revenue', 'all']).default('all'),
  sellerId: z.string().optional(),
  date: z.string().optional(),
  limit: z.string().default('50').transform(Number),
  companyId: z.string().optional(),
})

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(request.url)

    const queryParse = QuerySchema.safeParse({
      timeRange: searchParams.get('timeRange'),
      type: searchParams.get('type'),
      sellerId: searchParams.get('sellerId'),
      date: searchParams.get('date'),
      limit: searchParams.get('limit'),
      companyId: searchParams.get('companyId'),
    })

    if (!queryParse.success) {
      throw new ValidationError('Parámetros de consulta inválidos', queryParse.error.flatten().fieldErrors)
    }

    const { timeRange, type, sellerId, date, limit, companyId } = queryParse.data
    const isSeller = user.role === 'SELLER'
    const queryUserId = isSeller ? user.id : sellerId
    const targetCompanyId = companyId || user.companyId

    const dateRange = date
      ? (() => {
          const selectedDate = new Date(date)
          if (Number.isNaN(selectedDate.getTime())) {
            throw new ValidationError('Parámetros de consulta inválidos', {
              date: ['Fecha no válida'],
            })
          }

          const year = selectedDate.getUTCFullYear()
          const month = selectedDate.getUTCMonth()
          const day = selectedDate.getUTCDate()

          // Argentina = UTC-3. Para cubrir el día completo en Argentina:
          // Inicio: 00:00 Argentina = 03:00 UTC del mismo día
          // Fin: 23:59 Argentina = 02:59 UTC del día siguiente
          // Usamos un margen ampliado (desde las 00:00 UTC hasta las 05:59 UTC del día siguiente)
          const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
          const end = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999))

          return {
            start,
            end,
            label: selectedDate.toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
            }),
          }
        })()
      : getDateRangeFromTimeRange(timeRange as TimeRange)

    // Obtener deals con todos los detalles
    // Usamos un rango ampliado de horas para cubrir el offset UTC-3 de Argentina cuando se filtra por día específico
    const deals = await prisma.deal.findMany({
      where: {
        companyId: targetCompanyId,
        status: 'DELIVERED',
        updatedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        ...(queryUserId && { sellerId: queryUserId }),
      },
      select: {
        id: true,
        status: true,
        finalPrice: true,
        finalPriceCurrency: true,
        exchangeRate: true,
        updatedAt: true,
        createdAt: true,
        leadId: true,
        unitId: true,
        sellerId: true,
        seller: {
          select: {
            name: true,
            id: true,
          },
        },
        unit: {
          select: {
            title: true,
            vin: true,
            domain: true,
          },
        },
        lead: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    // Transformar a formato legible
    const dealDetails: DealDetail[] = deals.map((deal) => {
      const finalPrice = deal.finalPrice ? Number(deal.finalPrice.toString()) : 0
      const exchangeRate = deal.exchangeRate ? Number(deal.exchangeRate.toString()) : 1000
      const currency = deal.finalPriceCurrency || 'ARS'

      return {
        id: deal.id,
        unitCode: deal.unit?.title || deal.unit?.vin || deal.unit?.domain || 'N/A',
        sellerName: deal.seller?.name || 'N/A',
        sellerId: deal.sellerId,
        finalPrice,
        currency,
        exchangeRate,
        status: deal.status,
        deliveredAt: deal.updatedAt.toISOString(),
        createdAt: deal.createdAt.toISOString(),
        buyerName: deal.lead?.name,
        buyerPhone: deal.lead?.phone,
        unitModel: deal.unit?.vin || deal.unit?.domain || undefined,
      }
    })

    log.info(
      {
        userId: user.id,
        companyId: user.companyId,
        count: dealDetails.length,
        timeRange,
        type,
      },
      'Fetched deal details for analytics'
    )

    const response = successResponse({
      deals: dealDetails,
      count: dealDetails.length,
      period: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        label: dateRange.label,
      },
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')

    return response
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching deal details')

    if (error instanceof ValidationError) {
      const errResponse = errorResponse(error, { path: '/api/analytics/deals', method: 'GET' })
      errResponse.headers.set('Cache-Control', 'no-store')
      return errResponse
    }

    const errResponse = errorResponse(new Error('Error al obtener detalles de operaciones'), { path: '/api/analytics/deals', method: 'GET' })
    errResponse.headers.set('Cache-Control', 'no-store')
    return errResponse
  }
}
