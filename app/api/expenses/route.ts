import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { getCurrentUser, getCurrentUserFromHeaders } from '@/lib/shared/auth-helpers'
import { z } from 'zod'
import { kv } from '@vercel/kv'

const ExpenseSchema = z.object({
  category: z.string().min(1, 'Categoría es requerida'),
  description: z.string().optional(),
  amountArs: z.coerce.number().min(0).default(0),
  amountUsd: z.coerce.number().min(0).default(0),
  // Parsear la fecha como mediodía UTC para evitar desfases de timezone
  date: z.string().transform(str => {
    const [year, month, day] = str.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  }),
})

export async function GET(request: NextRequest) {
  try {
    // Fast-path: headers del middleware (0 queries DB)
    const user = await getCurrentUserFromHeaders(request)
    const companyId = user.companyId

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // e.g. "2024-05"

    let dateFilter = {}
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = parseInt(yearStr, 10)
      const m = parseInt(monthStr, 10) - 1 // 0-indexed month

      // Rango completo del mes en UTC
      const start = new Date(Date.UTC(year, m, 1, 0, 0, 0, 0))
      const end = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999))
      dateFilter = { date: { gte: start, lte: end } }
    }

    const expenses = await prisma.companyExpense.findMany({
      where: { companyId, isActive: true, ...dateFilter },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json({ success: true, data: expenses })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

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
    try {
      const types = ['dashboard', 'sales-profit', 'top-sellers', 'costs']
      const ranges = ['7d', '30d', '90d', '1y', 'all']
      
      const keys = []
      for (const t of types) {
        for (const r of ranges) {
          keys.push(`analytics:${companyId}:${t}:${r}`)
        }
      }
      
      if (keys.length > 0) {
        await kv.del(...keys)
      }
    } catch (kvErr) {
      console.error('Error invalidando cache:', kvErr)
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (error: unknown) {
    console.error('[POST /api/expenses] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
