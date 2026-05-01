export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { z } from 'zod'

const PaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'FINANCING', 'CRYPTO', 'OTHER']).default('CASH'),
  date: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/notes/[noteId]/installments/[instId]/payments — Payment history for an installment
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ noteId: string; instId: string }> }) => {
    const user = await getCurrentUser()
    const { noteId, instId } = await params

    // Security: verify note belongs to this company
    const note = await prisma.promissoryNote.findFirst({
      where: { id: noteId, companyId: user.companyId },
    })
    if (!note) throw new Error('Not found')

    const payments = await prisma.installmentPayment.findMany({
      where: { installmentId: instId },
      orderBy: { date: 'desc' },
    })

    return successResponse(payments)
  }
)

/**
 * POST /api/notes/[noteId]/installments/[instId]/payments — Register a payment
 */
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ noteId: string; instId: string }> }) => {
    const user = await getCurrentUser()
    const { noteId, instId } = await params
    const body = await req.json()
    const data = PaymentSchema.parse({ ...body, amount: Number(body.amount) })

    // Security: verify note belongs to this company
    const note = await prisma.promissoryNote.findFirst({
      where: { id: noteId, companyId: user.companyId },
    })
    if (!note) throw new Error('Not found')

    const [payment] = await prisma.$transaction([
      prisma.installmentPayment.create({
        data: {
          installmentId: instId,
          amount: data.amount,
          method: data.method,
          date: data.date ? new Date(data.date) : new Date(),
          notes: data.notes,
        },
      }),
      prisma.installment.update({
        where: { id: instId },
        data: { status: 'PAID', updatedAt: new Date() },
      }),
    ])

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'InstallmentPayment',
        resourceId: payment.id,
        after: { installmentId: instId, amount: data.amount, method: data.method },
        companyId: user.companyId,
        userId: user.id,
      },
    })

    return successResponse(payment)
  }
)
