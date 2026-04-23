import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { unitService } from '@/lib/domains/units/service'

/**
 * DELETE /api/units/[id]/costs/[costId] - Remove a cost item
 */
export const DELETE = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string; costId: string }> }) => {
    const user = await getCurrentUser()
    const { id, costId } = await params
    await unitService.deleteCostItem(costId, id, user.companyId)
    return successResponse({ deleted: true })
  }
)
