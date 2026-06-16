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

import { revalidateTag } from 'next/cache'
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
import { requirePermission } from '@/lib/shared/authz'
import type { UnitStatus, UnitType, Prisma } from '@prisma/client'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { requireRateLimit, RATE_LIMITS, getRequestIdentifier } from '@/lib/shared/rate-limit-memory'
import { canAddUnit } from '@/lib/shared/plan-limits'

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
  export?: boolean
  type?: UnitType
  status?: UnitStatus
  query?: string
  minPrice?: number
  maxPrice?: number
}

// function canManageUnits(role: string): boolean {
//   return role === 'ADMIN' || role === 'MANAGER'
// }

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
  const isExport = searchParams.get('export') === 'true'
  
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
    export: isExport,
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

export const GET = withTenantHandler(async (request: NextRequest): Promise<NextResponse> => {
  const startTime = Date.now()
  
  try {
    // 1. Rate limiting
    const identifier = getRequestIdentifier(request)
    await requireRateLimit(identifier, RATE_LIMITS.PUBLIC_API)
    
    // 2. Autenticación (fast-path: headers del middleware, 0 queries DB)
    const user = await getCurrentUserFromHeaders(request)
    log.debug({ userId: user.id, companyId: user.companyId, source: (await hasAuthHeaders(request)) ? 'headers' : 'fallback' }, 'GET /api/units - iniciado')

    // 3. Parseo de query params
    const { searchParams } = new URL(request.url)
    const filters = parseListQuery(searchParams)

    // 4. Construcción de where clause (SIEMPRE con tenantId)
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

    // 5. Ejecutar queries en paralelo
    const isExport = filters.export === true
    const skip = isExport ? undefined : (filters.page - 1) * filters.limit
    const take = isExport ? undefined : filters.limit
    
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
          createdBy: { select: { name: true } },
          _count: { select: { deals: true, interestedLeads: true } },
          // ✅ Solo primera foto para listado (evita N+1)
          photos: { 
            take: 1, 
            orderBy: { order: 'asc' }, 
            select: { url: true, order: true } 
          },
          // Campos adicionales para exportación profesional
          ...(isExport && {
            year: true,
            description: true,
            engineNumber: true,
            frameNumber: true,
            hin: true,
            registrationNumber: true,
            acquisitionCostArs: true,
            acquisitionCostUsd: true,
            acquisitionType: true,
            acquisitionDate: true,
          })
        },
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(take !== undefined && { take }),
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

    const mappedUnits = units.map(u => ({
      ...u,
      createdBy: u.createdBy?.name || null
    }))

    return paginatedResponse(mappedUnits, total, filters.page, filters.limit)

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
})

// ============================================================================
// HANDLER: POST /api/units
// ============================================================================

export const POST = withTenantHandler(async (request: NextRequest): Promise<NextResponse> => {
  const startTime = Date.now()

  try {
    // 1. Rate limiting
    const identifier = getRequestIdentifier(request)
    await requireRateLimit(identifier, RATE_LIMITS.AUTHENTICATED_API)
    
    // 2. Autenticación
    const user = await getCurrentUser()
    log.debug({ userId: user.id, companyId: user.companyId }, 'POST /api/units - iniciado')

    // Verify permission
    await requirePermission(user.id, user.companyId, 'units', 'manage_all')

    // Plan limit check
    const limitCheck = await canAddUnit(user.companyId)
    if (!limitCheck.allowed) {
      return errorResponse(
        new ForbiddenError(limitCheck.reason ?? 'Límite de unidades alcanzado'),
        { path: '/api/units', method: 'POST' }
      )
    }

    // 3. Validación del body con Zod
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

    // 4. Validación de negocio: verificar duplicados por VIN o dominio
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

    // 5. Crear unidad con fotos en transacción
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
          createdById: user.id,
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

      // Guardar en el diccionario personalizado de vehículos para uso futuro
      if (data.brand && data.model) {
        const brandStr = data.brand.trim()
        const modelStr = data.model.trim()
        if (brandStr && modelStr) {
          // Primero buscamos si existe para evitar errores de Unique constraint en concurrencia
          const exists = await tx.customVehicleDictionary.findUnique({
            where: {
              companyId_brand_model: {
                companyId: user.companyId,
                brand: brandStr,
                model: modelStr
              }
            }
          })
          
          if (!exists) {
            await tx.customVehicleDictionary.create({
              data: {
                companyId: user.companyId,
                brand: brandStr,
                model: modelStr
              }
            })
          }
        }
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

    revalidateTag('units', 'default')
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
})

