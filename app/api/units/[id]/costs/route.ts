export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { unitService } from '@/lib/domains/units/service'
import { ForbiddenError } from '@/lib/shared/errors'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const canManageUnits = (role: string) => role === 'ADMIN' || role === 'MANAGER'

// Validación Zod del payload de costo. Antes se hacia Number(body.x) sobre
// entrada cruda, lo que producía NaN/Infinity para strings no numéricos y
// aceptaba conceptos sin sanitizar ni límite de longitud.
const CreateCostItemSchema = z.object({
  concept: z.string().trim().min(1).max(200),
  amountArs: z.number().finite().nonnegative().max(2_000_000_000).nullable().optional(),
  amountUsd: z.number().finite().nonnegative().max(2_000_000).nullable().optional(),
})

/**
 * GET /api/units/[id]/costs - List all cost items for a unit
 */
export const GET = withTenantHandler(withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params
    const items = await unitService.getCostItems(id, user.companyId)
    return successResponse(items)
  }
))

/**
 * POST /api/units/[id]/costs - Add a cost item to a unit
 */
export const POST = withTenantHandler(withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!canManageUnits(user.role)) {
      throw new ForbiddenError('Only admins and managers can add cost items')
    }
    const { id } = await params
    const body = await req.json()
    const data = CreateCostItemSchema.parse(body)
    const item = await unitService.addCostItem(id, user.companyId, {
      concept: data.concept,
      amountArs: data.amountArs ?? null,
      amountUsd: data.amountUsd ?? null,
    })
    return successResponse(item)
  }
))
