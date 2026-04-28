export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { UpdateUnitSchema } from '@/lib/shared/validation'
import { unitService } from '@/lib/domains/units/service'
import { createLogger } from '@/lib/shared/logger'
import { ForbiddenError } from '@/lib/shared/errors'

const log = createLogger('UnitDetailRoutes')
const canManageUnits = (role: string) => role === 'ADMIN' || role === 'MANAGER'

export const maxDuration = 30

/**
 * GET /api/units/[id] - Get single unit with all relations
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    log.debug({ unitId: id }, 'Fetching unit detail')

    const unit = await unitService.getById(id, user.companyId)

    return successResponse(unit)
  }
)

/**
 * PUT /api/units/[id] - Update unit
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    const json = await request.json()
    const data = UpdateUnitSchema.parse(json)

    if (!canManageUnits(user.role)) {
      throw new ForbiddenError('Only admins and managers can update units')
    }

    log.info({ unitId: id, changes: Object.keys(data) }, 'Updating unit')

    const unit = await unitService.update(id, user.companyId, data as any)

    return successResponse(unit)
  }
)

/**
 * DELETE /api/units/[id] - Delete unit (soft delete)
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    if (!canManageUnits(user.role)) {
      throw new ForbiddenError('Only admins and managers can delete units')
    }

    log.info({ unitId: id }, 'Deleting unit')

    await unitService.delete(id, user.companyId)

    return successResponse({ deleted: true })
  }
)
