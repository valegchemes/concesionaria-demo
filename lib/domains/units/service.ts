// lib/domains/units/service.ts
/**
 * Unit Service - Business logic for inventory management
 * 
 * Handles:
 * - Creating, reading, updating, deleting units (vehicles, motorcycles, boats)
 * - Unit availability and status management
 * - Pricing in multiple currencies
 * - Search and filtering
 * - Validation and error handling
 */

import { Prisma, type DealStatus, type UnitType, type UnitStatus } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/shared/errors'
import { prisma } from '@/lib/shared/prisma'
import type {
  CreateUnitCommand,
  UpdateUnitCommand,
  UnitWithRelations,
  SearchUnitsFilter,
  UnitListResult,
  AddCostItemCommand,
  UnitCostItemDTO,
} from './types'

const log = createLogger('UnitService')

export class UnitService {
  /**
   * Create a new unit
   */
  async create(command: CreateUnitCommand): Promise<UnitWithRelations> {
    log.info(
      { companyId: command.companyId, title: command.title, type: command.type },
      'Creating unit'
    )

    // Validate that company exists
    const company = await prisma.company.findUnique({
      where: { id: command.companyId },
    })

    if (!company) {
      throw new NotFoundError('Company', command.companyId)
    }

    // Year and mileage removed since they are not on Prisma schema directly
    // Validate prices
    if (command.priceArs && command.priceArs < 0) {
      throw new ValidationError('Price ARS cannot be negative')
    }

    if (command.priceUsd && command.priceUsd < 0) {
      throw new ValidationError('Price USD cannot be negative')
    }

    // Create unit
    const unit = await prisma.unit.create({
      data: {
        title: command.title.trim(),
        type: command.type,
        priceArs: command.priceArs,
        priceUsd: command.priceUsd,
        acquisitionCostArs: command.acquisitionCostArs,
        acquisitionCostUsd: command.acquisitionCostUsd,
        description: command.description?.trim(),
        location: command.location?.trim(),
        status: command.status || 'AVAILABLE',
        vin: command.vin?.trim(),
        domain: command.domain?.trim(),
        engineNumber: command.engineNumber?.trim(),
        frameNumber: command.frameNumber?.trim(),
        hin: command.hin?.trim(),
        registrationNumber: command.registrationNumber?.trim(),
        tags: command.tags || [],
        companyId: command.companyId,
        ...(command.photos && command.photos.length > 0 && {
          photos: {
            create: command.photos.map(p => ({
              url: p.url,
              order: p.order,
            }))
          }
        }),
      },
      include: {
        photos: true,
        attributes: true,
      },
    })

    log.info({ unitId: unit.id, type: unit.type }, 'Unit created successfully')

    return unit
  }

  /**
   * Get unit by ID
   */
  async getById(id: string, companyId: string): Promise<UnitWithRelations> {
    log.debug({ unitId: id, companyId }, 'Fetching unit')

    const unit = await prisma.unit.findFirst({
      where: { id, companyId, isActive: true },
      include: {
        photos: { orderBy: { order: 'asc' } },
        attributes: true,
        costItems: { orderBy: { date: 'desc' } },
        interestedLeads: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            status: true,
            phone: true,
            assignedTo: { select: { name: true } },
          },
        },
        deals: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!unit) {
      throw new NotFoundError('Unit', id)
    }

    return unit
  }

  /**
   * Get all units for company with pagination and filtering
   */
  async list(companyId: string, filters: SearchUnitsFilter = {}): Promise<UnitListResult> {
    const { page = 1, limit = 20, type, status, minPrice, maxPrice, query } = filters

    log.debug({ companyId, page, limit, type, status }, 'Listing units')

    // Validate pagination
    const pageNum = Math.max(1, page)
    const limitNum = Math.max(1, Math.min(100, limit))
    const skip = (pageNum - 1) * limitNum

    // Build filter
    const where: Prisma.UnitWhereInput = {
      companyId,
      isActive: true,
      ...(type && { type: type as UnitType }),
      ...(status && { status: status as UnitStatus }),
      ...(minPrice && { priceArs: { gte: minPrice } }),
      ...(maxPrice && { priceArs: { lte: maxPrice } }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      }),
    }

    // Get total count and paginated results
    const [total, units] = await Promise.all([
      prisma.unit.count({ where }),
      prisma.unit.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          priceArs: true,
          priceUsd: true,
          status: true,
          location: true,
          tags: true,
          createdAt: true,
          // Solo la foto de portada en listados — el detalle carga todas las imágenes
          photos: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
          _count: { select: { photos: true, interestedLeads: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ])

    const totalPages = Math.ceil(total / limitNum)

    log.info({ total, returned: units.length, filters }, 'Units fetched')

    return {
      units: units.map(u => ({
        id: u.id,
        title: u.title,
        type: u.type as string,
        priceArs: u.priceArs ? Number(u.priceArs) : 0,
        priceUsd: u.priceUsd ? Number(u.priceUsd) : null,
        location: u.location,
        tags: u.tags,
        createdAt: u.createdAt,
        status: u.status as string,
        photoUrl: u.photos[0]?.url ?? null,
        _count: u._count,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    }
  }

  /**
   * Update unit
   */
  async update(
    id: string,
    companyId: string,
    command: UpdateUnitCommand
  ): Promise<UnitWithRelations> {
    log.info({ unitId: id, changes: Object.keys(command) }, 'Updating unit')

    // Get current unit
    const currentUnit = await this.getById(id, companyId)

    // Validate status transition if changing
    if (command.status && command.status !== currentUnit.status) {
      await this.validateStatusTransition(currentUnit.status, command.status)
    }

    // Validate prices
    if (command.priceArs && command.priceArs <= 0) {
      throw new ValidationError('Price ARS must be greater than 0')
    }

    // Update unit
    const updated = await prisma.unit.update({
      where: { id },
      data: {
        ...(command.title && { title: command.title.trim() }),
        ...(command.priceArs && { priceArs: command.priceArs }),
        ...(command.priceUsd && { priceUsd: command.priceUsd }),
        ...(command.acquisitionCostArs !== undefined && { acquisitionCostArs: command.acquisitionCostArs }),
        ...(command.acquisitionCostUsd !== undefined && { acquisitionCostUsd: command.acquisitionCostUsd }),
        ...(command.description !== undefined && { description: command.description?.trim() }),
        ...(command.status && { status: command.status as UnitStatus }),
        updatedAt: new Date(),
      },
      include: {
        photos: true,
        attributes: true,
      },
    })

    log.info({ unitId: id, newStatus: command.status }, 'Unit updated')

    return updated
  }

  /**
   * Delete unit (soft delete)
   */
  async delete(id: string, companyId: string): Promise<void> {
    log.info({ unitId: id }, 'Deleting unit')

    // Verify unit exists (sin filtrar isActive para poder borrar unidades vendidas)
    const unitExists = await prisma.unit.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!unitExists) throw new NotFoundError('Unit', id)

    // Check if unit has active leads or deals (only block for IN-PROGRESS deals)
    const [activeLeads, activeDeals] = await Promise.all([
      prisma.lead.count({
        where: { interestedUnitId: id, isActive: true },
      }),
      prisma.deal.count({
        where: {
          unitId: id,
          status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] as DealStatus[] },
        },
      }),
    ])

    if (activeLeads > 0 || activeDeals > 0) {
      throw new ConflictError(
        'No se puede eliminar una unidad con leads activos o una negociación en curso.'
      )
    }

    // Soft delete
    await prisma.unit.update({
      where: { id },
      data: { isActive: false },
    })

    log.info({ unitId: id }, 'Unit deleted')
  }

  /**
   * Validate status transition
   */
  private async validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      AVAILABLE: ['RESERVED', 'SOLD', 'DISCARDED'],
      RESERVED: ['AVAILABLE', 'SOLD', 'DISCARDED'],
      SOLD: [],
      DISCARDED: ['AVAILABLE'],
    }

    const allowed = validTransitions[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      )
    }
  }

  /**
   * Get available units by type and price range
   */
  async getAvailable(
    companyId: string,
    filters: {
      type?: string
      minPrice?: number
      maxPrice?: number
      limit?: number
    } = {}
  ) {
    log.debug({ companyId, filters }, 'Getting available units')

    return await prisma.unit.findMany({
      where: {
        companyId,
        isActive: true,
        status: 'AVAILABLE',
        ...(filters.type && { type: filters.type as UnitType }),
        ...(filters.minPrice && { priceArs: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { priceArs: { lte: filters.maxPrice } }),
      },
      select: {
        id: true,
        title: true,
        type: true,
        priceArs: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 10,
    })
  }

  /**
   * Search units by title, type, or mileage
   */
  async search(
    companyId: string,
    query: string,
    limit: number = 10
  ): Promise<
    Array<{
      id: string
      title: string
      type: string
      status: string
    }>
  > {
    log.debug({ companyId, query }, 'Searching units')

    const units = await prisma.unit.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
      },
      take: limit,
    })

    return units
  }

  /**
   * Get units by lead (interested units)
   */
  async getByLead(leadId: string, companyId: string) {
    log.debug({ leadId }, 'Getting units for lead')

    return await prisma.unit.findMany({
      where: {
        companyId,
        isActive: true,
        interestedLeads: {
          some: { id: leadId },
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        priceArs: true,
        status: true,
      },
    })
  }

  /**
   * Get units statistics
   */
  async getStats(companyId: string) {
    log.debug({ companyId }, 'Getting units statistics')

    const [total, byStatus, byType] = await Promise.all([
      prisma.unit.count({ where: { companyId, isActive: true } }),
      prisma.unit.groupBy({
        by: ['status'],
        where: { companyId, isActive: true },
        _count: true,
      }),
      prisma.unit.groupBy({
        by: ['type'],
        where: { companyId, isActive: true },
        _count: true,
      }),
    ])

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {} as Record<string, number>
      ),
      byType: byType.reduce(
        (acc, t) => ({ ...acc, [t.type]: t._count }),
        {} as Record<string, number>
      ),
    }
  }
  /**
   * Get cost items for a unit
   */
  async getCostItems(unitId: string, companyId: string): Promise<UnitCostItemDTO[]> {
    await this.getById(unitId, companyId) // verify access
    const items = await prisma.unitCostItem.findMany({
      where: { unitId },
      orderBy: { date: 'desc' },
    })
    return items.map(i => ({
      id: i.id,
      concept: i.concept,
      amountArs: i.amountArs ? Number(i.amountArs) : null,
      amountUsd: i.amountUsd ? Number(i.amountUsd) : null,
      date: i.date,
      unitId: i.unitId,
    }))
  }

  /**
   * Add a cost item to a unit
   */
  async addCostItem(unitId: string, companyId: string, command: AddCostItemCommand): Promise<UnitCostItemDTO> {
    await this.getById(unitId, companyId) // verify access

    if (!command.concept?.trim()) {
      throw new ValidationError('El concepto del gasto es requerido')
    }
    if (!command.amountArs && !command.amountUsd) {
      throw new ValidationError('Debe indicar al menos un monto (ARS o USD)')
    }

    const item = await prisma.unitCostItem.create({
      data: {
        unitId,
        concept: command.concept.trim(),
        amountArs: command.amountArs ?? null,
        amountUsd: command.amountUsd ?? null,
      },
    })

    log.info({ unitId, concept: item.concept }, 'Cost item added')

    return {
      id: item.id,
      concept: item.concept,
      amountArs: item.amountArs ? Number(item.amountArs) : null,
      amountUsd: item.amountUsd ? Number(item.amountUsd) : null,
      date: item.date,
      unitId: item.unitId,
    }
  }

  /**
   * Delete a cost item
   */
  async deleteCostItem(costItemId: string, unitId: string, companyId: string): Promise<void> {
    await this.getById(unitId, companyId) // verify access

    const item = await prisma.unitCostItem.findFirst({ where: { id: costItemId, unitId } })
    if (!item) throw new NotFoundError('CostItem', costItemId)

    await prisma.unitCostItem.delete({ where: { id: costItemId } })
    log.info({ costItemId, unitId }, 'Cost item deleted')
  }
}

// Export singleton
export const unitService = new UnitService()
