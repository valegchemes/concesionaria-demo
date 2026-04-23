export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { UpdateLeadSchema } from '@/lib/shared/validation'
import { leadService } from '@/lib/domains/leads/service'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('LeadDetailRoutes')

export const maxDuration = 30

/**
 * GET /api/leads/[id] - Get single lead with all relations
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    log.debug({ leadId: id }, 'Fetching lead detail')

    const lead = await leadService.getById(id, user.companyId)

    return successResponse(lead)
  }
)

/**
 * PUT /api/leads/[id] - Update lead
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const json = await request.json()
    const data = UpdateLeadSchema.parse(json)

    log.info({ leadId: id, changes: Object.keys(data) }, 'Updating lead')

    const lead = await leadService.update(id, user.companyId, data)

    return successResponse(lead)
  }
)

/**
 * DELETE /api/leads/[id] - Delete lead (soft delete)
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    log.info({ leadId: id }, 'Deleting lead')

    await leadService.delete(id, user.companyId)

    return successResponse({ deleted: true })
  }
)
