import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { dealService } from '@/lib/domains/deals/service'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('DealDetailRoutes')

export const maxDuration = 30

/**
 * GET /api/deals/[id] - Get single deal with all relations
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    log.debug({ dealId: id }, 'Fetching deal detail')

    const deal = await dealService.getById(id, user.companyId)

    return successResponse(deal)
  }
)

/**
 * PUT /api/deals/[id] - Update deal status or notes
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const json = await request.json()

    log.info({ dealId: id, changes: Object.keys(json) }, 'Updating deal')

    const deal = await dealService.update(id, user.companyId, json)

    return successResponse(deal)
  }
)

/**
 * POST /api/deals/[id]/payment - Record payment for deal
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const json = await request.json()
    const { amount, method, reference, notes } = json

    log.info({ dealId: id, amount, method }, 'Recording payment')

    const payment = await dealService.recordPayment(id, user.companyId, {
      amount,
      method,
      reference,
      notes,
    })

    return successResponse(payment, 201)
  }
)
