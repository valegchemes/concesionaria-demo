export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { unitService } from '@/lib/domains/units/service'

/**
 * GET /api/units/[id]/costs - List all cost items for a unit
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params
    const items = await unitService.getCostItems(id, user.companyId)
    return successResponse(items)
  }
)

/**
 * POST /api/units/[id]/costs - Add a cost item to a unit
 */
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params
    const body = await req.json()
    const item = await unitService.addCostItem(id, user.companyId, {
      concept: body.concept,
      amountArs: body.amountArs ? Number(body.amountArs) : null,
      amountUsd: body.amountUsd ? Number(body.amountUsd) : null,
    })
    return successResponse(item)
  }
)
