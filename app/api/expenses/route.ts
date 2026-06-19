export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getCurrentUserFromHeaders } from '@/lib/shared/auth-helpers'
import { z } from 'zod'
import { kv } from '@/lib/kv-client'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { invalidateAnalyticsCache } from '@/lib/domains/analytics/server-utils'
import { parsePagination } from '@/lib/shared/pagination'
import { paginatedResponse } from '@/lib/shared/api-response'

const ExpenseSchema = z.object({
  category: z.string().min(1, 'Categoría es requerida'),
  description: z.string().optional(),
  amountArs: z.coerce.number().min(0).default(0),
  amountUsd: z.coerce.number().min(0).max(2_000_000, "Monto en USD es anormalmente alto").default(0),
  // Parsear la fecha como mediodía UTC para evitar desfases de timezone
  date: z.string().transform(str => {
    const [year, month, day] = str.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  }),
})

// Columnas que necesita el frontend para listar gastos
const EXPENSE_SELECT = {
  id: true,
  category: true,
  description: true,
  amountArs: true,
  amountUsd: true,
  date: true,
} as const

export const GET = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUserFromHeaders(request)
    const companyId = user.companyId

    if (user.role === 'SELLER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // e.g. "2024-05"
    const pagination = parsePagination({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    let dateFilter = {}
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr, 10)
      const m = parseInt(monthStr, 10) - 1 // 0-indexed month
      const start = new Date(Date.UTC(year, m, 1, 0, 0, 0, 0))
      const end = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999))
      dateFilter = { date: { gte: start, lte: end } }
    }

    const where = { companyId, isActive: true, ...dateFilter }

    const [total, expenses] = await Promise.all([
      prisma.companyExpense.count({ where }),
      prisma.companyExpense.findMany({
        where,
        select: EXPENSE_SELECT,
        orderBy: { date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    return paginatedResponse(expenses, total, pagination.page, pagination.limit)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    if (user.role === 'SELLER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = ExpenseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      )
    }
    const data = parsed.data

    const expense = await prisma.companyExpense.create({
      data: {
        companyId,
        category: data.category,
        description: data.description,
        amountArs: data.amountArs,
        amountUsd: data.amountUsd,
        date: data.date,
      }
    })

    // Invalidar caché de analytics para este tenant
    await invalidateAnalyticsCache(companyId)

    return NextResponse.json({ success: true, data: expense })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
})
