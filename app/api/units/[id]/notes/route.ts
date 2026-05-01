export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { z } from 'zod'

const CreateNoteSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  issueDate: z.string(),
  dueDate: z.string(),
  notes: z.string().optional(),
  installmentCount: z.number().int().min(1).max(120),
})

/**
 * GET /api/units/[id]/notes — List all promissory notes with installments
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const notes = await prisma.promissoryNote.findMany({
      where: { unitId: id, companyId: user.companyId, isActive: true },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
          include: { payments: { orderBy: { date: 'desc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(notes)
  }
)

/**
 * POST /api/units/[id]/notes — Create a promissory note and generate installments
 */
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params
    const body = await req.json()
    const data = CreateNoteSchema.parse({
      ...body,
      amount: Number(body.amount),
      installmentCount: Number(body.installmentCount),
    })

    // Verify unit belongs to this company
    const unit = await prisma.unit.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!unit) throw new Error('Unit not found')

    const issueDate = new Date(data.issueDate)
    const installmentAmount = Math.round((data.amount / data.installmentCount) * 100) / 100

    const note = await prisma.promissoryNote.create({
      data: {
        amount: data.amount,
        currency: data.currency,
        issueDate,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        unitId: id,
        companyId: user.companyId,
        installments: {
          create: Array.from({ length: data.installmentCount }, (_, i) => {
            const dueDate = new Date(issueDate)
            dueDate.setMonth(dueDate.getMonth() + i + 1)
            return {
              installmentNumber: i + 1,
              amount: installmentAmount,
              dueDate,
              status: 'PENDING',
            }
          }),
        },
      },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
          include: { payments: true },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'PromissoryNote',
        resourceId: note.id,
        after: { amount: data.amount, installmentCount: data.installmentCount },
        companyId: user.companyId,
        userId: user.id,
      },
    })

    return successResponse(note)
  }
)
