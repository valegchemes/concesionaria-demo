export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse, paginatedResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { parsePagination } from '@/lib/shared/pagination'
import { CreateLeadSchema } from '@/lib/shared/validation'
import { leadService } from '@/lib/domains/leads/service'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('LeadRoutes')

export const maxDuration = 30

/**
 * GET /api/leads - List all leads for company
 * Query params: page, limit, status, assignedToId
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const { searchParams } = new URL(request.url)
  const pagination = parsePagination({
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined,
  })
  const status = searchParams.get('status') || undefined
  const assignedToId = searchParams.get('assignedToId') || undefined

  log.info(
    { page: pagination.page, limit: pagination.limit, status },
    'Fetching leads list'
  )

  const { leads, pagination: paginationMeta } = await leadService.list(
    user.companyId,
    {
      id: user.id,
      role: user.role,
    },
    {
      page: pagination.page,
      limit: pagination.limit,
      status: status as string | undefined,
      assignedToId: assignedToId as string | undefined,
    }
  )

  return paginatedResponse(
    leads,
    paginationMeta.total,
    paginationMeta.page,
    paginationMeta.limit
  )
})

/**
 * POST /api/leads - Create new lead
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const json = await request.json()
  const data = CreateLeadSchema.parse(json)

  log.info({ leadName: data.name }, 'Creating new lead')

  const lead = await leadService.create({
    ...data,
    companyId: user.companyId,
    createdById: user.id,
  }, {
    id: user.id,
    role: user.role,
  })

  return successResponse(lead, 201)
})
