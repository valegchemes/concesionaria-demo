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
  timeRange: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  type: z.enum(['revenue', 'all']).default('all'),
  sellerId: z.string().optional(),
  date: z.string().optional(),
  limit: z.string().default('50').transform(Number),
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
      limit: searchParams.get('limit'),
    })

    if (!queryParse.success) {
      throw new ValidationError('Parámetros de consulta inválidos', queryParse.error.flatten().fieldErrors)
    }

    const { timeRange, type, sellerId, date, limit } = queryParse.data
    const isSeller = user.role === 'SELLER'
    const queryUserId = isSeller ? user.id : sellerId

    const dateRange = date
      ? (() => {
          const selectedDate = new Date(date)
          if (Number.isNaN(selectedDate.getTime())) {
            throw new ValidationError('Parámetros de consulta inválidos', {
              date: ['Fecha no válida'],
            })
          }

          const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0)
          const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999)

          return {
            start,
            end,
            label: selectedDate.toLocaleDateString('es-AR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }),
          }
        })()
      : getDateRangeFromTimeRange(timeRange)

    // Obtener deals con todos los detalles
    const deals = await prisma.deal.findMany({
      where: {
        companyId: user.companyId,
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

    return successResponse({
      deals: dealDetails,
      count: dealDetails.length,
      period: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        label: dateRange.label,
      },
    })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching deal details')

    if (error instanceof ValidationError) {
      return errorResponse(error, { path: '/api/analytics/deals', method: 'GET' })
    }

    return errorResponse(new Error('Error al obtener detalles de operaciones'), { path: '/api/analytics/deals', method: 'GET' })
  }
}
