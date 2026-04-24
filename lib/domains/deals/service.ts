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

import { Prisma, type DealStatus, type PaymentMethod, type UnitStatus, type LeadStatus } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/shared/errors'
import { prisma } from '@/lib/shared/prisma'
import type {
  CreateDealCommand,
  UpdateDealCommand,
  RecordPaymentCommand,
  AddCostItemCommand,
  DealWithRelations,
  DealSummary,
  DealListResult,
} from './types'

const log = createLogger('DealService')

export class DealService {
  /**
   * Create a new deal
   */
  async create(command: CreateDealCommand): Promise<DealWithRelations> {
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

    // Validate amount
    if (command.finalPrice <= 0) {
      throw new ValidationError('Final price must be greater than 0')
    }

    // Check for existing active deals for this unit
    /*
    const existingDeal = await prisma.deal.findFirst({
      where: {
        unitId: command.unitId,
        status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] },
      },
    })

    if (existingDeal) {
      throw new ConflictError(
        'Unit already has an active deal. Please close or complete the existing deal first.'
      )
    }
    */

    // Create deal
    const deal = await prisma.deal.create({
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
    }) as unknown as DealWithRelations

    log.info({ dealId: deal.id }, 'Deal created successfully')

    // Update lead status to indicate deal in progress
    await prisma.lead.update({
      where: { id: command.leadId },
      data: { status: 'OFFER' },
    })

    return deal
  }

  /**
   * Get deal by ID
   */
  async getById(id: string, companyId: string): Promise<DealWithRelations> {
    log.debug({ dealId: id, companyId }, 'Fetching deal')

    const deal = await prisma.deal.findFirst({
      where: { id, companyId },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        unit: { select: { id: true, title: true, type: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        closingCosts: { orderBy: { id: 'asc' } },
        tradeIn: true,
        seller: { select: { id: true, name: true, email: true } },
      },
    }) as unknown as DealWithRelations

    if (!deal) {
      throw new NotFoundError('Deal', id)
    }

    return deal
  }

  /**
   * Get all deals for company with pagination
   */
  async list(
    companyId: string,
    {
      page = 1,
      limit = 20,
      status,
      soldById,
    }: {
      page?: number
      limit?: number
      status?: string
      soldById?: string
    } = {}
  ): Promise<DealListResult> {
    log.debug({ companyId, page, limit, status }, 'Listing deals')

    const pageNum = Math.max(1, page)
    const limitNum = Math.max(1, Math.min(100, limit))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.DealWhereInput = {
      companyId,
      ...(status && { status: status as DealStatus }),
      ...(soldById && { soldById }),
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
          lead: { select: { name: true, phone: true } },
          unit: { select: { title: true, type: true } },
          seller: { select: { name: true } },
          createdAt: true,
          _count: { select: { payments: true, closingCosts: true } },
        },
        orderBy: { createdAt: 'desc' },
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
      lead: d.lead ?? undefined,
      unit: d.unit ?? undefined,
      seller: d.seller ?? undefined,
      createdAt: d.createdAt,
      _count: { payments: d._count.payments, costItems: d._count.closingCosts },
    })) as any

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
   */
  async update(
    id: string,
    companyId: string,
    command: UpdateDealCommand
  ): Promise<DealWithRelations> {
    log.info({ dealId: id, changes: Object.keys(command) }, 'Updating deal')

    // Get current deal
    const currentDeal = await this.getById(id, companyId)

    // Validate status transition
    if (command.status && command.status !== currentDeal.status) {
      await this.validateStatusTransition(currentDeal.status, command.status)
    }

    // Update deal
    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...(command.status && { status: command.status }),
        ...(command.notes !== undefined && { notes: command.notes?.trim() || null }),
        ...(command.finalPrice && { finalPrice: command.finalPrice }),
        ...(command.finalPriceCurrency && { finalPriceCurrency: command.finalPriceCurrency }),
        // Setear closedAt cuando se cierra el deal (para analíticas correctas)
        ...(command.status && ['DELIVERED', 'CANCELED'].includes(command.status) && { closedAt: new Date() }),
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

    return updated
  }

  /**
   * Record payment
   */
  async recordPayment(
    dealId: string,
    companyId: string,
    command: RecordPaymentCommand
  ) {
    log.info({ dealId, amount: command.amount }, 'Recording payment')

    // Verify deal exists
    const deal = await this.getById(dealId, companyId)

    // Validate amount
    if (command.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0')
    }

    // Check if payment would exceed deal amount
    const summary = await this.getSummary(dealId, companyId)
    if (summary.totalPayments + command.amount > Number(deal.finalPrice)) {
      throw new ValidationError(
        `Payment exceeds remaining balance of ${summary.remainingBalance}`
      )
    }

    // Create payment
    const payment = await prisma.dealPayment.create({
      data: {
        dealId,
        amount: command.amount,
        method: command.method as PaymentMethod,
        notes: command.notes,
      },
    })

    log.info({ paymentId: payment.id, dealId }, 'Payment recorded')

    // Auto-mark deal as completed if fully paid
    if (summary.totalPayments + command.amount >= Number(deal.finalPrice)) {
      await this.update(dealId, companyId, { status: 'DELIVERED' })
      log.info({ dealId }, 'Deal auto-marked as delivered (fully paid)')
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
      } as any,
    })

    log.info({ costItemId: costItem.id, dealId }, 'Cost item added')

    return costItem
  }

  /**
   * Get deal summary (payments, costs, balance)
   */
  async getSummary(dealId: string, companyId: string): Promise<any> {
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
      finalPrice: Number(deal.finalPrice),
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

    // Update deal status to delivered (DELIVERED is the final state, CLOSED doesn't exist)
    await this.update(dealId, companyId, {
      status: 'DELIVERED' as any,
      ...(completionNotes && { notes: completionNotes }),
    })

    // Update unit to sold
    await prisma.unit.update({
      where: { id: deal.unitId },
      data: { status: 'SOLD' as UnitStatus },
    })

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
    const validTransitions: Record<string, string[]> = {
      NEGOTIATION: ['RESERVED', 'APPROVED', 'CANCELED'],
      RESERVED: ['APPROVED', 'NEGOTIATION', 'CANCELED'],
      APPROVED: ['IN_PAYMENT', 'NEGOTIATION', 'CANCELED'],
      IN_PAYMENT: ['DELIVERED', 'NEGOTIATION', 'CANCELED'],
      DELIVERED: ['CANCELED'],
      CANCELED: [],
    }

    const allowed = validTransitions[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      )
    }
  }

  /**
   * Get deals by status
   */
  async getByStatus(
    companyId: string,
    status: 'NEGOTIATION' | 'RESERVED' | 'APPROVED' | 'IN_PAYMENT' | 'DELIVERED' | 'CANCELED'
  ): Promise<Array<{ id: string; finalPrice: any; lead: { name: string } }>> {
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
   */
  async delete(id: string, companyId: string): Promise<void> {
    log.info({ dealId: id, companyId }, 'Deleting deal')

    const deal = await prisma.deal.findFirst({
      where: { id, companyId },
    })

    if (!deal) {
      throw new NotFoundError('Deal', id)
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
