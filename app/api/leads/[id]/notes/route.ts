import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { z } from 'zod'

const CreateNoteSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  installmentsCount: z.number().int().min(1).max(120),
  issueDate: z.string(),
  notes: z.string().optional(),
  unitId: z.string(),
})

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  const { id: leadId } = await params

  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: user.companyId } })
  if (!lead) return successResponse([], 200)

  const notes = await prisma.promissoryNote.findMany({
    where: { leadId, companyId: user.companyId },
    include: {
      unit: { select: { id: true, title: true } },
      installments: {
        include: { payments: true },
        orderBy: { installmentNumber: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return successResponse(notes)
})

export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  const { id: leadId } = await params
  const body = await req.json()
  const data = CreateNoteSchema.parse(body)

  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: user.companyId } })
  if (!lead) throw new Error('Lead not found')

  const unit = await prisma.unit.findFirst({ where: { id: data.unitId, companyId: user.companyId } })
  if (!unit) throw new Error('Unit not found')

  const issueDate = new Date(data.issueDate)
  const installmentAmount = Math.round((data.amount / data.installmentsCount) * 100) / 100

  const note = await prisma.promissoryNote.create({
    data: {
      amount: data.amount,
      currency: data.currency as any,
      issueDate,
      dueDate: addMonths(issueDate, data.installmentsCount),
      notes: data.notes,
      unitId: data.unitId,
      leadId,
      companyId: user.companyId,
      updatedAt: new Date(),
      installments: {
        create: Array.from({ length: data.installmentsCount }, (_, i) => ({
          id: `${Date.now()}-${i}`,
          installmentNumber: i + 1,
          amount: installmentAmount,
          dueDate: addMonths(issueDate, i + 1),
          updatedAt: new Date(),
        })),
      },
    },
    include: {
      unit: { select: { id: true, title: true } },
      installments: { orderBy: { installmentNumber: 'asc' } },
    },
  })

  return successResponse(note, 201)
})
