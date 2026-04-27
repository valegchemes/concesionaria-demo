import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { z } from 'zod'

const ExpenseSchema = z.object({
  category: z.string().min(1, 'Categoría es requerida'),
  description: z.string().optional(),
  amountArs: z.number().min(0).default(0),
  amountUsd: z.number().min(0).default(0),
  date: z.string().transform(str => new Date(str)),
})

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) return NextResponse.json({ error: 'No company ID' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // e.g. "2024-05"

    let dateFilter = {}
    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
      dateFilter = { date: { gte: start, lte: end } }
    }

    const expenses = await prisma.companyExpense.findMany({
      where: { companyId, ...dateFilter },
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
    const companyId = request.headers.get('x-company-id')
    if (!companyId) return NextResponse.json({ error: 'No company ID' }, { status: 401 })

    const body = await request.json()
    const data = ExpenseSchema.parse(body)

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

    return NextResponse.json({ success: true, data: expense })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
