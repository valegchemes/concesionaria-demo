export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'

/**
 * GET /api/units/[id]/notes — List all promissory notes for a unit (read-only).
 * Notes are created via /api/leads/[id]/notes.
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const unit = await prisma.unit.findFirst({ where: { id, companyId: user.companyId } })
    if (!unit) return successResponse([])

    const notes = await prisma.promissoryNote.findMany({
      where: { unitId: id, companyId: user.companyId },
      include: {
        lead: { select: { id: true, name: true } },
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
