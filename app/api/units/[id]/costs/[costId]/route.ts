export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { unitService } from '@/lib/domains/units/service'
import { ForbiddenError } from '@/lib/shared/errors'

const canManageUnits = (role: string) => role === 'ADMIN' || role === 'MANAGER'

/**
 * DELETE /api/units/[id]/costs/[costId] - Remove a cost item
 */
export const DELETE = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string; costId: string }> }) => {
    const user = await getCurrentUser()
    if (!canManageUnits(user.role)) {
      throw new ForbiddenError('Only admins and managers can delete cost items')
    }
    const { id, costId } = await params
    await unitService.deleteCostItem(costId, id, user.companyId)
    return successResponse({ deleted: true })
  }
)
