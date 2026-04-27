import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) return NextResponse.json({ error: 'No company ID' }, { status: 401 })

    const { id } = await params

    // Verify ownership
    const expense = await prisma.companyExpense.findUnique({ where: { id } })
    if (!expense || expense.companyId !== companyId) {
      return NextResponse.json({ error: 'No encontrado o sin permisos' }, { status: 404 })
    }

    await prisma.companyExpense.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
