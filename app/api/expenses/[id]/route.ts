import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { createLogger } from '@/lib/shared/logger'
import { kv } from '@vercel/kv'

const log = createLogger('API:Expenses')

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) return NextResponse.json({ error: 'No company ID' }, { status: 401 })

    const { id } = await params

    // Verify ownership and expense is active
    const expense = await prisma.companyExpense.findFirst({
      where: { id, companyId, isActive: true }
    })
    if (!expense) {
      return NextResponse.json({ error: 'No encontrado o sin permisos' }, { status: 404 })
    }

    // Soft delete
    await prisma.companyExpense.update({
      where: { id },
      data: { isActive: false }
    })

    log.info({ expenseId: id, companyId }, 'Expense soft deleted')

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

    return NextResponse.json({ success: true, deleted: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
