/**
 * Enterprise API Route: /api/units
 * - Runtime: Edge (baja latencia)
 * - Validación: Zod completa
 * - Autenticación: Via headers de middleware
 * - Multi-tenancy: tenantId obligatorio en todas las queries
 * - Respuestas: Estructura estandarizada
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/shared/prisma'
import { getCurrentUser, getCurrentUserFromHeaders, hasAuthHeaders } from '@/lib/shared/auth-helpers'
import { CreateUnitSchema } from '@/lib/shared/validation'
import { 
  successResponse, 
  errorResponse, 
  paginatedResponse 
} from '@/lib/shared/api-response'
import { 
  ForbiddenError, 
  ValidationError,
  isAppError
} from '@/lib/shared/errors'
import { createLogger } from '@/lib/shared/logger'
import type { UnitStatus, UnitType, Prisma } from '@prisma/client'

const log = createLogger('API:Units')

// ============================================================================
// TIPOS ESTRUCTURADOS (sin 'any')
// ============================================================================

interface AuthenticatedUser {
  userId: string
  companyId: string
  role: string
}

interface ListUnitsQuery {
  page: number
  limit: number
  type?: UnitType
  status?: UnitStatus
  query?: string
  minPrice?: number
  maxPrice?: number
}

function canManageUnits(role: string): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

// ============================================================================
// UTILIDADES DE AUTENTICACIÓN
// ============================================================================

/**
 * Extrae el usuario autenticado de los headers inyectados por el middleware
 * El middleware garantiza que estos headers existen para rutas protegidas
 */
// ============================================================================
// PARSEO Y VALIDACIÓN DE QUERY PARAMS
// ============================================================================

function parseListQuery(searchParams: URLSearchParams): ListUnitsQuery {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10)))
  
  const type = searchParams.get('type') as UnitType | null
  const status = searchParams.get('status') as UnitStatus | null
  const query = searchParams.get('query') ?? undefined
  
  const minPrice = searchParams.get('minPrice') 
    ? parseFloat(searchParams.get('minPrice')!) 
    : undefined
  const maxPrice = searchParams.get('maxPrice') 
    ? parseFloat(searchParams.get('maxPrice')!) 
    : undefined

  return {
    page,
    limit,
    ...(type && { type }),
    ...(status && { status }),
    ...(query && { query }),
    ...(minPrice !== undefined && { minPrice }),
    ...(maxPrice !== undefined && { maxPrice }),
  }
}

// ============================================================================
// HANDLER: GET /api/units
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // 1. Autenticación (fast-path: headers del middleware, 0 queries DB)
    const user = await getCurrentUserFromHeaders(request)
    log.debug({ userId: user.id, companyId: user.companyId, source: hasAuthHeaders(request) ? 'headers' : 'fallback' }, 'GET /api/units - iniciado')

    // 2. Parseo de query params
    const { searchParams } = new URL(request.url)
    const filters = parseListQuery(searchParams)

    // 3. Construcción de where clause (SIEMPRE con tenantId)
    const where: Prisma.UnitWhereInput = {
      companyId: user.companyId, // 🔒 Multi-tenancy: SIEMPRE filtrar por companyId
      isActive: true,
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.query && {
        OR: [
          { title: { contains: filters.query, mode: 'insensitive' } },
          { description: { contains: filters.query, mode: 'insensitive' } },
          { vin: { contains: filters.query, mode: 'insensitive' } },
          { domain: { contains: filters.query, mode: 'insensitive' } },
        ],
      }),
      ...(filters.minPrice !== undefined && { priceArs: { gte: filters.minPrice } }),
      ...(filters.maxPrice !== undefined && { priceArs: { lte: filters.maxPrice } }),
    }

    // 4. Ejecutar queries en paralelo
    const skip = (filters.page - 1) * filters.limit
    
    const [total, units] = await Promise.all([
      prisma.unit.count({ where }),
      prisma.unit.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priceArs: true,
          priceUsd: true,
          location: true,
          vin: true,
          domain: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { deals: true, interestedLeads: true } },
          photos: { orderBy: { order: 'asc' }, select: { url: true, order: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
    ])

    log.info(
      { 
        userId: user.id, 
        companyId: user.companyId,
        count: units.length, 
        total,
        duration: Date.now() - startTime 
      },
      'GET /api/units - completado'
    )

    return paginatedResponse(units, total, filters.page, filters.limit)

  } catch (error) {
    log.error(
      { 
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime 
      },
      'GET /api/units - error'
    )

    if (isAppError(error)) {
      return errorResponse(error, { path: '/api/units', method: 'GET' })
    }

    return errorResponse(
      new Error('Error interno del servidor'),
      { path: '/api/units', method: 'GET' }
    )
  }
}

// ============================================================================
// HANDLER: POST /api/units
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // 1. Autenticación
    const user = await getCurrentUser()
    log.debug({ userId: user.id, companyId: user.companyId }, 'POST /api/units - iniciado')

    if (!canManageUnits(user.role)) {
      throw new ForbiddenError('Solo administradores o managers pueden crear unidades')
    }

    // 2. Validación del body con Zod
    const body = await request.json()
    const validationResult = CreateUnitSchema.safeParse(body)

    if (!validationResult.success) {
      const zodError = validationResult.error
      log.warn(
        { 
          userId: user.id,
          errors: zodError.flatten().fieldErrors 
        },
        'POST /api/units - validación fallida'
      )
      
      return errorResponse(
        new ValidationError(
          'Datos de entrada inválidos',
          zodError.flatten().fieldErrors
        ),
        { path: '/api/units', method: 'POST' }
      )
    }

    const data = validationResult.data

    // 3. Validación de negocio: verificar duplicados por VIN o dominio
    if (data.vin || data.domain) {
      const duplicateWhere: Prisma.UnitWhereInput = {
        companyId: user.companyId, // 🔒 Multi-tenancy
        isActive: true,
        OR: [
          ...(data.vin ? [{ vin: data.vin }] : []),
          ...(data.domain ? [{ domain: data.domain }] : []),
        ],
      }

      const existing = await prisma.unit.findFirst({
        where: duplicateWhere,
        select: { id: true, vin: true, domain: true },
      })

      if (existing) {
        throw new ValidationError(
          `Ya existe una unidad con ${existing.vin === data.vin ? 'VIN' : 'dominio'} duplicado`
        )
      }
    }

    // 4. Crear unidad con fotos en transacción
    const unit = await prisma.$transaction(async (tx) => {
      // Crear unidad
      const newUnit = await tx.unit.create({
        data: {
          title: data.title,
          type: data.type,
          priceArs: data.priceArs ?? null,
          priceUsd: data.priceUsd ?? null,
          acquisitionCostArs: data.acquisitionCostArs ?? null,
          acquisitionCostUsd: data.acquisitionCostUsd ?? null,
          description: data.description ?? null,
          location: data.location ?? null,
          status: data.status ?? 'AVAILABLE',
          vin: data.vin ?? null,
          domain: data.domain ?? null,
          engineNumber: data.engineNumber ?? null,
          frameNumber: data.frameNumber ?? null,
          hin: data.hin ?? null,
          registrationNumber: data.registrationNumber ?? null,
          tags: data.tags ?? [],
          companyId: user.companyId, // 🔒 Multi-tenancy
        },
      })

      // Crear fotos si existen
      if (data.photos && data.photos.length > 0) {
        await tx.unitPhoto.createMany({
          data: data.photos.map((photo, index) => ({
            url: photo.url,
            order: photo.order ?? index,
            unitId: newUnit.id,
          })),
        })
      }

      return newUnit
    })

    log.info(
      { 
        userId: user.id,
        companyId: user.companyId,
        unitId: unit.id,
        duration: Date.now() - startTime 
      },
      'POST /api/units - unidad creada'
    )

    return successResponse(unit, 201)

  } catch (error) {
    log.error(
      { 
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime 
      },
      'POST /api/units - error'
    )

    if (isAppError(error)) {
      return errorResponse(error, { path: '/api/units', method: 'POST' })
    }

    if (error instanceof ZodError) {
      return errorResponse(
        new ValidationError('Error de validación', error.flatten().fieldErrors),
        { path: '/api/units', method: 'POST' }
      )
    }

    return errorResponse(
      new Error('Error interno del servidor'),
      { path: '/api/units', method: 'POST' }
    )
  }
}

