export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { dealService } from '@/lib/domains/deals/service'
import { createLogger } from '@/lib/shared/logger'
import { createAuditLog } from '@/lib/shared/audit-log'
import { applyRateLimit } from '@/lib/rate-limit-kv'
import { UpdateDealSchema } from '@/lib/shared/validation'
import { hasAnyPermission } from '@/lib/shared/authz'

const log = createLogger('DealDetailRoutes')

export const maxDuration = 30

/**
 * GET /api/deals/[id] - Get single deal with all relations
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    if (!hasAnyPermission(user.permissions, 'deals', ['read_all', 'read_own'])) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const { id } = await params

    log.debug({ dealId: id }, 'Fetching deal detail')

    const deal = await dealService.getById(id, user.companyId, {
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    })

    return successResponse(deal)
  }
)

/**
 * PUT /api/deals/[id] - Update deal status or notes
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Rate limiting
    const blocked = await applyRateLimit(request)
    if (blocked) return blocked

    const user = await getCurrentUser()
    if (!hasAnyPermission(user.permissions, 'deals', ['manage_all', 'manage_own'])) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const { id } = await params
    const json = await request.json()
    const data = UpdateDealSchema.parse(json)

    log.info({ dealId: id, changes: Object.keys(data) }, 'Updating deal')

    const deal = await dealService.update(id, user.companyId, data, {
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    })

    await createAuditLog({
      action: 'update',
      resource: 'Deal',
      resourceId: deal.id,
      before: undefined,
      after: deal,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: user.companyId,
      userId: user.id,
    })

    return successResponse(deal)
  }
)

/**
 * POST /api/deals/[id]/payment - Record payment for deal
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Rate limiting estricto para operaciones financieras
    const blocked = await applyRateLimit(request, { strict: true })
    if (blocked) return blocked

    const user = await getCurrentUser()
    if (!hasAnyPermission(user.permissions, 'deals', ['manage_all'])) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const { id } = await params
    const json = await request.json()
    const { amount, method, reference, notes } = json

    log.info({ dealId: id, amount, method }, 'Recording payment')

    const payment = await dealService.recordPayment(id, user.companyId, {
      amount,
      method,
      reference,
      notes,
    }, {
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    })

    await createAuditLog({
      action: 'create',
      resource: 'DealPayment',
      resourceId: payment.id,
      after: payment,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: user.companyId,
      userId: user.id,
    })

    return successResponse(payment, 201)
  }
)

/**
 * DELETE /api/deals/[id] - Delete a deal permanently
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Rate limiting
    const blocked = await applyRateLimit(request)
    if (blocked) return blocked

    const user = await getCurrentUser()
    if (!hasAnyPermission(user.permissions, 'deals', ['manage_all'])) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const { id } = await params

    log.info({ dealId: id }, 'Deleting deal')

    await dealService.delete(id, user.companyId, {
      id: user.id,
      role: user.role,
      permissions: user.permissions,
    })

    await createAuditLog({
      action: 'delete',
      resource: 'Deal',
      resourceId: id,
      before: undefined,
      after: undefined,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: user.companyId,
      userId: user.id,
    })

    return successResponse({ deleted: true })
  }
)
