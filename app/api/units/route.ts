export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse, paginatedResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { parsePagination } from '@/lib/shared/pagination'
import { CreateUnitSchema, UpdateUnitSchema } from '@/lib/shared/validation'
import { unitService } from '@/lib/domains/units/service'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('UnitRoutes')

// Vercel: tiempo máximo de ejecución (segundos)
export const maxDuration = 30

/**
 * GET /api/units - List all units for company
 * Query params: page, limit, type, status, minPrice, maxPrice, query
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const { searchParams } = new URL(request.url)
  const pagination = parsePagination({
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined,
  })
  const type = searchParams.get('type') || undefined
  const status = searchParams.get('status') || undefined
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const query = searchParams.get('query') || searchParams.get('q')

  log.info(
    {
      page: pagination.page,
      limit: pagination.limit,
      type,
      status,
      query,
    },
    'Fetching units list'
  )

  const { units, pagination: paginationMeta } = await unitService.list(
    user.companyId,
    {
      page: pagination.page,
      limit: pagination.limit,
      type: type as string | undefined,
      status: status as string | undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      query: query as string | undefined,
    }
  )

  return paginatedResponse(
    units,
    paginationMeta.total,
    paginationMeta.page,
    paginationMeta.limit
  )
})

/**
 * POST /api/units - Create new unit
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()

  const json = await request.json()
  const data = CreateUnitSchema.parse(json)

  log.info({ title: data.title, type: data.type }, 'Creating new unit')

  const unit = await unitService.create({
    ...data,
    companyId: user.companyId,
    createdById: user.id,
  })

  return successResponse(unit, 201)
})
