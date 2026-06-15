export const dynamic = 'force-dynamic'
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser, requirePermission } from '@/lib/shared/auth-helpers'
import { UpdateUnitSchema, type UpdateUnitInput } from '@/lib/shared/validation'
import { unitService } from '@/lib/domains/units/service'
import { createLogger } from '@/lib/shared/logger'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const log = createLogger('UnitDetailRoutes')
export const maxDuration = 30

/**
 * GET /api/units/[id] - Get single unit with all relations
 */
export const GET = withTenantHandler(withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    log.debug({ unitId: id }, 'Fetching unit detail')

    const unit = await unitService.getById(id, user.companyId)

    return successResponse(unit)
  }
))

/**
 * PUT /api/units/[id] - Update unit
 */
export const PUT = withTenantHandler(withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requirePermission('units', 'manage_all')
    const { id } = await params

    const json = await request.json()
    const data = UpdateUnitSchema.parse(json) as any

    log.info({ unitId: id, changes: Object.keys(data) }, 'Updating unit')

    const unit = await unitService.update(id, user.companyId, data)

    revalidateTag('units')
    return successResponse(unit)
  }
))

/**
 * DELETE /api/units/[id] - Delete unit (soft delete)
 */
export const DELETE = withTenantHandler(withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requirePermission('units', 'manage_all')
    const { id } = await params

    log.info({ unitId: id }, 'Deleting unit')

    await unitService.delete(id, user.companyId)

    revalidateTag('units')
    return successResponse({ deleted: true })
  }
))
