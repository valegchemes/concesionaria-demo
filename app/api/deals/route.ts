export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse, paginatedResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { parsePagination } from '@/lib/shared/pagination'
import { CreateDealSchema } from '@/lib/shared/validation'
import { dealService } from '@/lib/domains/deals/service'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('DealRoutes')

export const maxDuration = 30

/**
 * GET /api/deals - List all deals for company
 * Query params: page, limit, status, soldById
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const { searchParams } = new URL(request.url)
  const pagination = parsePagination({
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined,
  })
  const status = searchParams.get('status') || undefined
  const soldById = searchParams.get('soldById') || undefined

  log.info(
    {
      page: pagination.page,
      limit: pagination.limit,
      status,
    },
    'Fetching deals list'
  )

  const { deals, pagination: paginationMeta } = await dealService.list(
    user.companyId,
    {
      page: pagination.page,
      limit: pagination.limit,
      status: status as string | undefined,
      soldById: soldById as string | undefined,
    }
  )

  return paginatedResponse(
    deals,
    paginationMeta.total,
    paginationMeta.page,
    paginationMeta.limit
  )
})

/**
 * POST /api/deals - Create new deal
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const json = await request.json()
  const data = CreateDealSchema.parse(json)

  log.info(
    { leadId: data.leadId, unitId: data.unitId, amount: data.finalPrice },
    'Creating new deal'
  )

  const deal = await dealService.create({
    ...data,
    companyId: user.companyId,
    sellerId: data.sellerId,
    createdById: user.id,
  })

  return successResponse(deal, 201)
})
