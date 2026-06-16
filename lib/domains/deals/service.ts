// lib/domains/deals/service.ts
/**
 * Deal Service - Business logic for sales and transactions
 * 
 * Handles:
 * - Creating and managing deals
 * - Deal status workflow (NEW → NEGOTIATING → OFFERED → ACCEPTED → COMPLETED → CLOSED)
 * - Payment tracking and reconciliation
 * - Cost items and expenses
 * - Trade-ins
 * - Deal summaries and financial reporting
 */

import { prisma, withTransaction } from '@/lib/shared/prisma'
import { DealStatus, Prisma, UnitStatus, LeadStatus, PaymentMethod } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/shared/errors'
import { hasPermission } from '@/lib/shared/authz'
import { unitService } from '@/lib/domains/units/service'
import type {
  CreateDealCommand,
  UpdateDealCommand,
  RecordPaymentCommand,
  AddCostItemCommand,
  DealSummary,
  DealWithRelations,
  DealListResult,
  RequestingUser,
} from './types'

const log = createLogger('DealService')

export class DealService {
  /**
   * Create a new deal
   */
  async create(command: CreateDealCommand, requestingUser: RequestingUser): Promise<DealWithRelations> {
    log.info(
      {
        companyId: command.companyId,
        leadId: command.leadId,
        unitId: command.unitId,
        amount: command.finalPrice,
      },
      'Creating deal'
    )

    // Validate lead exists
    const lead = await prisma.lead.findFirst({
      where: { id: command.leadId, companyId: command.companyId, isActive: true },
    })

    if (!lead) {
      throw new NotFoundError('Lead', command.leadId)
    }

    // Validate unit exists
    const unit = await prisma.unit.findFirst({
      where: { id: command.unitId, companyId: command.companyId, isActive: true },
    })

    if (!unit) {
      throw new NotFoundError('Unit', command.unitId)
    }

    // Validate seller exists
    const seller = await prisma.user.findFirst({
      where: { id: command.sellerId, companyId: command.companyId },
    })

    if (!seller) {
      throw new NotFoundError('User', command.sellerId)
    }

    if (!hasPermission(requestingUser.permissions, 'deals', 'manage_all') && command.sellerId !== requestingUser.id) {
      throw new ValidationError('You can only create deals assigned to yourself')
    }

    // Validate amount
    if (command.finalPrice <= 0) {
      throw new ValidationError('Final price must be greater than 0')
    }

    // Block parallel active deals for the same unit
    const existingDeal = await prisma.deal.findFirst({
      where: {
        unitId: command.unitId,
        companyId: command.companyId,
        status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] },
      },
    })

    if (existingDeal) {
      throw new ConflictError(
        'Unit already has an active deal. Please close or complete the existing deal first.'
      )
    }

    // Create deal and trade-in inside a transaction
    const deal = await withTransaction(async (tx) => {
      const newDeal = await tx.deal.create({
        data: {
          finalPrice: command.finalPrice,
          finalPriceCurrency: command.finalPriceCurrency,
          status: command.status || 'NEGOTIATION',
          depositAmount: command.depositAmount,
          leadId: command.leadId,
          unitId: command.unitId,
          sellerId: command.sellerId,
          notes: command.notes?.trim(),
          companyId: command.companyId,
        },
        include: {
          lead: { select: { id: true, name: true, phone: true } },
          unit: { select: { id: true, title: true, type: true } },
          payments: true,
          closingCosts: true,
          seller: { select: { id: true, name: true, email: true } },
        },
      })

      if (command.tradeIn) {
        // 1. Create the Unit for the trade-in
        const newUnit = await tx.unit.create({
          data: {
            title: command.tradeIn.description,
            type: command.tradeIn.type as any,
            status: 'IN_PREP',
            priceArs: command.finalPriceCurrency === 'ARS' ? command.tradeIn.expectedValue : null,
            priceUsd: command.finalPriceCurrency === 'USD' ? command.tradeIn.expectedValue : null,
            acquisitionCostArs: command.finalPriceCurrency === 'ARS' ? command.tradeIn.expectedValue : null,
            acquisitionCostUsd: command.finalPriceCurrency === 'USD' ? command.tradeIn.expectedValue : null,
            acquisitionType: 'TRADE_IN',
            isFromTradeIn: true,
            companyId: command.companyId,
            createdById: command.createdById || command.sellerId,
            ...(command.tradeIn.photos && command.tradeIn.photos.length > 0 && {
              photos: {
                create: command.tradeIn.photos.map((p, index) => ({
                  url: p.url,
                  order: p.order ?? index,
                }))
              }
            })
          }
        })

        // 2. Create the TradeIn record
        const tradeInRecord = await tx.tradeIn.create({
          data: {
            description: command.tradeIn.description,
            expectedValue: command.tradeIn.expectedValue,
            offeredValue: command.tradeIn.expectedValue,
            finalValue: command.tradeIn.expectedValue,
            isConverted: true,
            convertedToUnitId: newUnit.id,
            convertedAt: new Date(),
            dealId: newDeal.id,
          }
        })

        // Sincronizar tradeInId en el Unit por las dudas
        await tx.unit.update({
          where: { id: newUnit.id },
          data: { tradeInId: tradeInRecord.id }
        })

        ;(newDeal as any).tradeIn = tradeInRecord
      }

      // Sincronizar estados si la operación es RESERVADA
      if (newDeal.status === 'RESERVED') {
        await Promise.all([
          tx.lead.update({
            where: { id: command.leadId },
            data: { status: 'RESERVED' },
          }),
          tx.unit.update({
            where: { id: command.unitId },
            data: { status: 'RESERVED' },
          })
        ])
      } else {
        // Update lead status to indicate deal in progress
        await tx.lead.update({
          where: { id: command.leadId },
          data: { status: 'OFFER' },
        })
      }

      return newDeal as unknown as DealWithRelations
    })

    log.info({ dealId: deal.id }, 'Deal created successfully')

    return deal
  }

  /**
   * Get deal by ID
   */
  async getById(
    id: string,
    companyId: string,
    requestingUser?: RequestingUser
  ): Promise<DealWithRelations> {
    log.debug({ dealId: id, companyId }, 'Fetching deal')

    const deal = await prisma.deal.findFirst({
      where: { id, companyId },
      include: {
        lead: { 
          include: {
            tasks: {
              where: { isCompleted: false },
              orderBy: { dueDate: 'asc' },
              take: 5
            }
          }
        },
        unit: { select: { id: true, title: true, type: true } },
        payments: { select: { id: true, amount: true, method: true, notes: true, receivedAt: true, createdAt: true }, orderBy: { receivedAt: 'desc' } },
        closingCosts: { select: { id: true, concept: true, amountArs: true, amountUsd: true }, orderBy: { id: 'asc' } },
        tradeIn: true,
        seller: { select: { id: true, name: true, email: true, whatsappNumber: true, commissionRate: true } },
      },
    }) as unknown as DealWithRelations

    if (!deal) {
      throw new NotFoundError('Deal', id)
    }

    if (
      requestingUser &&
      !hasPermission(requestingUser.permissions, 'deals', 'manage_all') &&
      deal.sellerId !== requestingUser.id
    ) {
      throw new ValidationError('You can only view deals assigned to you')
    }

    return deal
  }

  /**
   * Get all deals for company with pagination
   */
  async list(
    companyId: string,
    requestingUser: RequestingUser,
    {
      page = 1,
      limit = 20,
      status,
      soldById,
      updatedAtFrom,
      updatedAtTo,
    }: {
      page?: number
      limit?: number
      status?: string
      soldById?: string
      updatedAtFrom?: Date
      updatedAtTo?: Date
    } = {}
  ): Promise<DealListResult> {
    log.debug({ companyId, page, limit, status }, 'Listing deals')

    const pageNum = Math.max(1, page)
    const limitNum = Math.max(1, Math.min(100, limit))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.DealWhereInput = {
      companyId,
      ...(status 
        ? { status: status as DealStatus } 
        : { status: { not: 'CANCELED' } } // Exclude CANCELED deals by default
      ),
      ...(soldById && { sellerId: soldById }),
      ...(!hasPermission(requestingUser.permissions, 'deals', 'manage_all') && requestingUser.role !== 'ADMIN' && requestingUser.role !== 'MANAGER' && { sellerId: requestingUser.id }),
      ...(updatedAtFrom || updatedAtTo ? {
        updatedAt: {
          ...(updatedAtFrom && { gte: updatedAtFrom }),
          ...(updatedAtTo && { lte: updatedAtTo }),
        },
      } : {}),
    }

    const [total, rawDeals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        select: {
          id: true,
          status: true,
          finalPrice: true,
          finalPriceCurrency: true,
          exchangeRate: true,
          updatedAt: true,
          lead: { select: { name: true, phone: true } },
          unit: { select: { title: true, type: true, vin: true, domain: true, acquisitionCostArs: true, acquisitionCostUsd: true } },
          seller: { select: { name: true, id: true } },
          createdAt: true,
          _count: { select: { payments: true, closingCosts: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ])

    const deals = rawDeals.map(d => ({
      id: d.id,
      status: d.status as string,
      grossAmount: Number(d.finalPrice),
      finalPrice: Number(d.finalPrice),
      finalPriceCurrency: d.finalPriceCurrency,
      exchangeRate: d.exchangeRate ? Number(d.exchangeRate) : null,
      lead: d.lead ?? undefined,
      unit: d.unit ?? undefined,
      seller: d.seller ?? undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      _count: { payments: d._count.payments, costItems: d._count.closingCosts },
    })) as DealListResult['deals']

    const totalPages = Math.ceil(total / limitNum)

    log.info({ total, returned: deals.length }, 'Deals fetched')

    return {
      deals,
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
   * Update deal
   * 
   * Ownership: Admin can update any deal, seller can update their own deals
   */
  async update(
    id: string,
    companyId: string,
    command: UpdateDealCommand,
    requestingUser: RequestingUser
  ): Promise<DealWithRelations> {
    log.info({ dealId: id, changes: Object.keys(command), requestingUserId: requestingUser.id }, 'Updating deal')

    // Get current deal with ownership info
    const currentDeal = await prisma.deal.findFirst({
      where: { id, companyId },
      include: { seller: { select: { id: true } } }
    })

    if (!currentDeal) {
      throw new NotFoundError('Deal', id)
    }

    // Ownership check: Admin/Manager or the assigned seller can update
    const isSeller = currentDeal.sellerId === requestingUser.id
    const canManageAll = hasPermission(requestingUser.permissions, 'deals', 'manage_all')
    
    if (!isSeller && !canManageAll) {
      throw new ValidationError('You can only update deals assigned to you')
    }

    // Delegate to internal update logic
    return this.updateInternal(id, companyId, command, currentDeal)
  }

  /**
   * Internal update logic (without ownership checks - for internal use only)
   */
  private async updateInternal(
    id: string,
    companyId: string,
    command: UpdateDealCommand,
    currentDeal?: { status: string; unitId: string; leadId: string; finalPrice: Prisma.Decimal }
  ): Promise<DealWithRelations> {
    // Get current deal if not provided or missing commission data
    const deal = currentDeal && 'seller' in currentDeal ? currentDeal : await this.getById(id, companyId)

    // Validate status transition
    if (command.status && command.status !== deal.status) {
      await this.validateStatusTransition(deal.status, command.status)
    }

    // Calcular comisión si se marca como ENTREGADO o si se edita el precio final de una operación ya entregada
    let commissionValue: number | undefined = undefined
    const isBecomingDelivered = command.status === 'DELIVERED' && deal.status !== 'DELIVERED'
    const isPriceChangedOnDelivered = deal.status === 'DELIVERED' && command.finalPrice !== undefined

    if (isBecomingDelivered || isPriceChangedOnDelivered) {
      // Necesitamos asegurar que tenemos la comisión del seller. Fetch si es necesario:
      const sellerIdToUse = (deal as any).seller?.id || (deal as any).sellerId;
      const sellerData = await prisma.user.findUnique({ where: { id: sellerIdToUse }, select: { commissionRate: true } })
      if (sellerData?.commissionRate && Number(sellerData.commissionRate) > 0) {
        commissionValue = Number(command.finalPrice || deal.finalPrice) * (Number(sellerData.commissionRate) / 100)
      }
    }

    // Update deal
    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(command.status && { status: command.status }),
        ...(command.notes !== undefined && { notes: command.notes?.trim() || null }),
        ...(command.finalPrice && { finalPrice: command.finalPrice }),
        ...(command.finalPriceCurrency && { finalPriceCurrency: command.finalPriceCurrency }),
        ...(command.exchangeRate !== undefined && { exchangeRate: command.exchangeRate }),
        // Setear closedAt cuando se cierra el deal (para analíticas correctas)
        ...(command.status && ['DELIVERED', 'CANCELED'].includes(command.status) && { closedAt: new Date() }),
        ...(commissionValue !== undefined && { commissionValue }),
        updatedAt: new Date(),
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        unit: { select: { id: true, title: true, type: true } },
        payments: true,
        closingCosts: true,
        seller: { select: { id: true, name: true, email: true } },
      },
    }) as unknown as DealWithRelations

    log.info({ dealId: id, newStatus: command.status }, 'Deal updated')

    // Sincronizar estado de unidad y lead SOLO cuando el deal se marca como ENTREGADO (DELIVERED)
    if (command.status === 'DELIVERED') {
      await prisma.lead.update({
        where: { id: deal.leadId },
        data: { status: 'SOLD' as LeadStatus },
      })
      // Archivar unidad principal
      await unitService.archiveUnit(deal.unitId, companyId)
      // Archivar unidad de trade-in si existe
      const tradeIn = await prisma.tradeIn.findFirst({
        where: { dealId: id, isConverted: true },
        select: { convertedToUnitId: true },
      })
      if (tradeIn?.convertedToUnitId) {
        await unitService.archiveUnit(tradeIn.convertedToUnitId, companyId)
        log.info({ dealId: id, tradeInUnitId: tradeIn.convertedToUnitId }, 'Trade-in unit archived')
      }
      log.info({ dealId: id, unitId: deal.unitId }, 'Unit archived and lead marked as SOLD')
    } else if (command.status === 'RESERVED') {
      await Promise.all([
        prisma.unit.update({
          where: { id: deal.unitId },
          data: { status: 'RESERVED' as UnitStatus },
        }),
        prisma.lead.update({
          where: { id: deal.leadId },
          data: { status: 'RESERVED' as LeadStatus },
        }),
      ])
      log.info({ dealId: id, unitId: deal.unitId }, 'Unit and lead marked as RESERVED')
    } else if (command.status === 'CANCELED' && deal.status === 'RESERVED') {
      // Si se cancela una reserva, liberar la unidad
      await prisma.unit.update({
        where: { id: deal.unitId },
        data: { status: 'AVAILABLE' as UnitStatus },
      })
      log.info({ dealId: id, unitId: deal.unitId }, 'Unit marked as AVAILABLE after canceled reservation')
    }

    return updated
  }

  /**
   * Record payment
   * 
   * Uses transaction with Serializable isolation to prevent race conditions
   * where two concurrent payments could exceed the deal amount.
   */
  async recordPayment(
    dealId: string,
    companyId: string,
    command: RecordPaymentCommand,
    requestingUser: RequestingUser
  ) {
    log.info({ 
      dealId, 
      amount: command.amount,
      requestingUserId: requestingUser.id,
      requestingUserRole: requestingUser.role,
      paymentMethod: command.method,
      timestamp: new Date().toISOString()
    }, 'Payment recording initiated')

    let becameFullyPaid = false;
    let unitIdForArchive = '';

    const payment = await withTransaction(async (tx) => {
      // ── Pessimistic Row-Level Lock (SELECT FOR UPDATE) ────────────────────
      // Bloquea la fila del Deal en PostgreSQL para que ninguna transacción
      // concurrente pueda leer ni modificar el saldo hasta que esta termine.
      // Esto elimina la race condition donde dos pagos simultáneos podrían
      // superar el monto total del trato y corromper la contabilidad.
      await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`
      // ─────────────────────────────────────────────────────────────────────

      // Leer el deal DESPUÉS del lock — datos frescos garantizados
      const deal = await tx.deal.findFirst({
        where: { id: dealId, companyId }
      })

      if (!deal) {
        throw new NotFoundError('Deal', dealId)
      }

      // Verify ownership
      const isSeller = deal.sellerId === requestingUser.id
      const canManageAll = hasPermission(requestingUser.permissions, 'deals', 'manage_all')
      if (!isSeller && !canManageAll) {
        throw new ValidationError('You can only record payments for your own deals')
      }

      // Validate amount
      if (command.amount <= 0) {
        throw new ValidationError('Payment amount must be greater than 0')
      }

      // Calculate current payments (fresh data within transaction)
      const payments = await tx.dealPayment.findMany({
        where: { dealId }
      })
      const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const remainingBalance = Number(deal.finalPrice) - totalPayments

      // Check if payment would exceed deal amount
      if (totalPayments + command.amount > Number(deal.finalPrice)) {
        throw new ValidationError(
          `Payment exceeds remaining balance of ${remainingBalance.toFixed(2)}`
        )
      }

      // Create payment
      const payment = await tx.dealPayment.create({
        data: {
          dealId,
          amount: command.amount,
          method: command.method as PaymentMethod,
          notes: command.notes,
        },
      })

      // Auto-mark deal as completed if fully paid
      if (totalPayments + command.amount >= Number(deal.finalPrice)) {
        becameFullyPaid = true;
        unitIdForArchive = deal.unitId;

        // Calcular comisión al auto-completar
        const sellerData = await tx.user.findUnique({ where: { id: deal.sellerId }, select: { commissionRate: true } })
        let commissionValue = 0
        if (sellerData?.commissionRate && Number(sellerData.commissionRate) > 0) {
          commissionValue = Number(deal.finalPrice) * (Number(sellerData.commissionRate) / 100)
        }

        await tx.deal.update({
          where: { id: dealId },
          data: { 
            status: 'DELIVERED' as DealStatus, 
            closedAt: new Date(),
            commissionValue 
          }
        })
        
        await tx.lead.update({
          where: { id: deal.leadId },
          data: { status: 'SOLD' as LeadStatus }
        })
      }

      // Log successful payment with full context
      log.info({
        paymentId: payment.id,
        dealId,
        amount: command.amount,
        requestingUserId: requestingUser.id,
        totalPaid: totalPayments + command.amount,
        finalPrice: Number(deal.finalPrice),
        remainingBalance: Number(deal.finalPrice) - (totalPayments + command.amount),
        isFullyPaid: totalPayments + command.amount >= Number(deal.finalPrice),
        timestamp: new Date().toISOString()
      }, 'Payment recorded successfully')

      return payment
    })

    // If deal became fully paid, trigger unit archiving outside transaction
    if (becameFullyPaid && unitIdForArchive) {
      unitService.archiveUnit(unitIdForArchive, companyId).catch(err => {
        log.error({ err, unitId: unitIdForArchive }, 'Failed to archive unit after payment completion')
      })
    }

    return payment
  }

  /**
   * Add cost item
   */
  async addCostItem(
    dealId: string,
    companyId: string,
    command: AddCostItemCommand
  ) {
    log.info({ dealId, description: command.description }, 'Adding cost item')

    // Verify deal exists
    await this.getById(dealId, companyId)

    // Validate amount
    if (command.amount < 0) {
      throw new ValidationError('Cost amount cannot be negative')
    }

    // Create cost item (concept maps to description in domain)
    const costItem = await prisma.dealCostItem.create({
      data: {
        dealId,
        concept: command.description.trim(),
        amountArs: command.amount,
      },
    })

    log.info({ costItemId: costItem.id, dealId }, 'Cost item added')

    return costItem
  }

  /**
   * Get deal summary (payments, costs, balance)
   */
  async getSummary(dealId: string, companyId: string): Promise<DealSummary> {
    log.debug({ dealId }, 'Getting deal summary')

    const deal = await this.getById(dealId, companyId)

    // Get payments and costs
    const [payments, costItems] = await Promise.all([
      prisma.dealPayment.findMany({ where: { dealId } }),
      prisma.dealCostItem.findMany({ where: { dealId } }),
    ])

    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalCosts = costItems.reduce((sum, c) => sum + Number(c.amountArs || 0), 0)
    const netAmount = Number(deal.finalPrice) - totalCosts

    return {
      dealId,
      grossAmount: Number(deal.finalPrice),
      totalPayments,
      remainingBalance: Math.max(0, netAmount - totalPayments),
      totalCosts,
      netAmount,
      paymentCount: payments.length,
      costItemCount: costItems.length,
    }
  }

  /**
   * Close deal
   */
  async closeDeal(
    dealId: string,
    companyId: string,
    completionNotes?: string
  ): Promise<void> {
    log.info({ dealId }, 'Closing deal')

    // Get deal
    const deal = await this.getById(dealId, companyId)

    // Check if deal is fully paid
    const summary = await this.getSummary(dealId, companyId)
    if (summary.remainingBalance > 0) {
      throw new ConflictError(
        `Deal has outstanding balance of ${summary.remainingBalance}. Cannot close.`
      )
    }

    // Update deal status to delivered (system operation, no ownership check)
    await this.updateInternal(dealId, companyId, {
      status: 'DELIVERED',
      ...(completionNotes && { notes: completionNotes }),
    })

    // Archive unit (sets status to SOLD, cleans up images and heavy fields)
    await unitService.archiveUnit(deal.unitId, companyId)

    // Update lead to sold
    await prisma.lead.update({
      where: { id: deal.leadId },
      data: { status: 'SOLD' as LeadStatus },
    })

    log.info({ dealId }, 'Deal closed successfully')
  }

  /**
   * Validate status transition
   */
  private async validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): Promise<void> {
    // No se puede salir de CANCELED
    if (currentStatus === 'CANCELED') {
      throw new ValidationError(
        `No se puede cambiar el estado de una operación cancelada`
      )
    }

    // No se puede revertir DELIVERED a un estado activo
    const activeStates = ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT']
    if (currentStatus === 'DELIVERED' && activeStates.includes(newStatus)) {
      throw new ValidationError(
        `No se puede revertir una operación ya entregada`
      )
    }

    // Todas las demás transiciones son válidas (flexibilidad para el vendedor)
  }

  /**
   * Get deals by status
   */
  async getByStatus(
    companyId: string,
    status: 'NEGOTIATION' | 'RESERVED' | 'APPROVED' | 'IN_PAYMENT' | 'DELIVERED' | 'CANCELED'
  ): Promise<Array<{ id: string; finalPrice: Prisma.Decimal; lead: { name: string } }>> {
    log.debug({ companyId, status }, 'Getting deals by status')

    return await prisma.deal.findMany({
      where: { companyId, status },
      select: {
        id: true,
        finalPrice: true,
        lead: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  /**
   * Get deal statistics
   */
  async getStats(companyId: string) {
    log.debug({ companyId }, 'Getting deals statistics')

    const [total, byStatus, totalRevenue] = await Promise.all([
      prisma.deal.count({ where: { companyId } }),
      prisma.deal.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),
      prisma.deal.aggregate({
        where: { companyId, status: 'DELIVERED' },
        _sum: { finalPrice: true },
      }),
    ])

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {} as Record<string, number>
      ),
      totalRevenue: Number(totalRevenue._sum?.finalPrice || 0),
    }
  }
  /**
   * Delete a deal permanently
   * 
   * Ownership: Admin can delete any deal, seller can delete their own deals
   */
  async delete(
    id: string, 
    companyId: string,
    requestingUser: RequestingUser
  ): Promise<void> {
    log.info({ dealId: id, companyId, requestingUserId: requestingUser.id }, 'Deleting deal')

    const deal = await prisma.deal.findFirst({
      where: { id, companyId },
      select: { sellerId: true }
    })

    if (!deal) {
      throw new NotFoundError('Deal', id)
    }

    // Ownership check
    const isSeller = deal.sellerId === requestingUser.id
    const canManageAll = hasPermission(requestingUser.permissions, 'deals', 'manage_all')
    
    if (!isSeller && !canManageAll) {
      throw new ValidationError('You can only delete deals assigned to you')
    }

    // Delete cascade: payments and cost items first
    await prisma.$transaction([
      prisma.dealPayment.deleteMany({ where: { dealId: id } }),
      prisma.dealCostItem.deleteMany({ where: { dealId: id } }),
      prisma.deal.delete({ where: { id } }),
    ])

    log.info({ dealId: id }, 'Deal deleted successfully')
  }
}

// Export singleton
export const dealService = new DealService()
