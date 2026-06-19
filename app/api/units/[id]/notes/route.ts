export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'

/**
 * GET /api/units/[id]/notes — List all promissory notes for a unit (read-only).
 * Notes are created via /api/leads/[id]/notes.
 */
export const GET = withTenantHandler(withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const unit = await prisma.unit.findFirst({ where: { id, companyId: user.companyId } })
    if (!unit) return successResponse([])

    const notes = await prisma.promissoryNote.findMany({
      where: { unitId: id, companyId: user.companyId },
      select: {
        id: true,
        amount: true,
        currency: true,
        issueDate: true,
        dueDate: true,
        notes: true,
        createdAt: true,
        lead: { select: { id: true, name: true } },
        installments: {
          select: {
            id: true,
            installmentNumber: true,
            amount: true,
            dueDate: true,
            status: true,
            payments: {
              select: { id: true, amount: true, date: true, method: true },
              orderBy: { date: 'desc' },
            },
          },
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(notes)
  }
))
