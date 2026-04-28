// lib/domains/leads/service.ts
/**
 * Lead Service - Business logic for lead management
 * 
 * Handles:
 * - Creating, reading, updating, deleting leads
 * - Lead status transitions
 * - Assignment logic
 * - Validation and error handling
 * - Event emission (future: webhooks, notifications)
 */

import { Prisma, type LeadSource, type LeadStatus } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/shared/errors'
import { prisma } from '@/lib/shared/prisma'
import type { CreateLeadCommand, UpdateLeadCommand, LeadWithRelations, RequestingUser } from './types'

const log = createLogger('LeadService')

function canManageAllLeads(role: string): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

export class LeadService {
  /**
   * Create a new lead
   */
  async create(command: CreateLeadCommand, requestingUser: RequestingUser): Promise<LeadWithRelations> {
    log.info({ companyId: command.companyId, leadName: command.name }, 'Creating lead')

    // Validate that company exists
    const company = await prisma.company.findUnique({
      where: { id: command.companyId },
    })

    if (!company) {
      throw new NotFoundError('Company', command.companyId)
    }

    // Check for duplicate phone in same company
    const existingLead = await prisma.lead.findFirst({
      where: { phone: command.phone, companyId: command.companyId, isActive: true },
    })

    if (existingLead) {
      throw new ConflictError(
        `Lead with phone ${command.phone} already exists in this company`
      )
    }

    if (
      command.assignedToId &&
      command.assignedToId !== requestingUser.id &&
      !canManageAllLeads(requestingUser.role)
    ) {
      throw new ValidationError('You can only assign leads to yourself')
    }

    if (command.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: command.assignedToId, companyId: command.companyId, isActive: true },
      })

      if (!assignee) {
        throw new NotFoundError('User', command.assignedToId)
      }
    }

    if (command.interestedUnitId) {
      const interestedUnit = await prisma.unit.findFirst({
        where: { id: command.interestedUnitId, companyId: command.companyId, isActive: true },
      })

      if (!interestedUnit) {
        throw new NotFoundError('Unit', command.interestedUnitId)
      }
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name: command.name.trim(),
        phone: command.phone.trim(),
        email: command.email?.toLowerCase().trim(),
        source: command.source as LeadSource,
        notes: command.notes?.trim(),
        assignedToId: command.assignedToId || null,
        interestedUnitId: command.interestedUnitId || null,
        companyId: command.companyId,
        createdById: command.createdById,
        status: (command.status || 'NEW') as LeadStatus,
      },
      include: {
        activities: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    log.info({ leadId: lead.id }, 'Lead created successfully')

    // TODO: Emit event for webhooks/notifications
    // await eventBus.emit('lead.created', { leadId: lead.id, companyId })

    return lead as LeadWithRelations
  }

  /**
   * Get lead by ID
   */
  async getById(
    id: string,
    companyId: string,
    requestingUser?: RequestingUser
  ): Promise<LeadWithRelations> {
    log.debug({ leadId: id, companyId }, 'Fetching lead')

    const lead = await prisma.lead.findFirst({
      where: { id, companyId, isActive: true },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        interestedUnit: { select: { id: true, title: true } },
        deals: { 
          orderBy: { createdAt: 'desc' }, 
          take: 5,
          include: { unit: { select: { id: true, title: true } } }
        },
        tasks: { where: { isCompleted: false }, orderBy: { dueDate: 'asc' } },
      },
    })

    if (!lead) {
      throw new NotFoundError('Lead', id)
    }

    const canAccess =
      !requestingUser ||
      canManageAllLeads(requestingUser.role) ||
      lead.assignedToId === requestingUser.id ||
      lead.createdById === requestingUser.id

    if (!canAccess) {
      throw new ValidationError('You can only view leads assigned to you or created by you')
    }

    return lead
  }

  /**
   * Get all leads for company with pagination
   */
  async list(
    companyId: string,
    requestingUser: RequestingUser,
    {
      page = 1,
      limit = 20,
      status,
      assignedToId,
    }: {
      page?: number
      limit?: number
      status?: string
      assignedToId?: string
    } = {}
  ) {
    log.debug({ companyId, page, limit, status }, 'Listing leads')

    // Validate pagination
    const pageNum = Math.max(1, page)
    const limitNum = Math.max(1, Math.min(100, limit))
    const skip = (pageNum - 1) * limitNum

    // Build filter
    const where: Prisma.LeadWhereInput = {
      companyId,
      isActive: true,
      ...(status && { status: status as LeadStatus }),
      ...(assignedToId && { assignedToId }),
      ...(!canManageAllLeads(requestingUser.role) && {
        OR: [
          { assignedToId: requestingUser.id },
          { createdById: requestingUser.id },
        ],
      }),
    }

    // Get total count and paginated results
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          source: true,
          status: true,
          notes: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { activities: true, tasks: true, deals: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ])

    const totalPages = Math.ceil(total / limitNum)

    log.info({ total, returned: leads.length }, 'Leads fetched')

    return {
      leads,
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
   * Update lead
   * 
   * Ownership: Admin can update any lead, others can only update their own or unassigned leads
   */
  async update(
    id: string,
    companyId: string,
    command: UpdateLeadCommand,
    requestingUser: RequestingUser
  ): Promise<LeadWithRelations> {
    // Get current lead with ownership info
    const currentLead = await prisma.lead.findFirst({
      where: { id, companyId },
      include: { assignedTo: { select: { id: true } } }
    })

    if (!currentLead) {
      throw new NotFoundError('Lead', id)
    }

    log.info({ 
      leadId: id, 
      changes: Object.keys(command), 
      requestingUserId: requestingUser.id,
      requestingUserRole: requestingUser.role,
      isOwner: currentLead.assignedToId === requestingUser.id || currentLead.createdById === requestingUser.id,
      previousStatus: currentLead.status,
      newStatus: command.status,
      previousAssignedToId: currentLead.assignedToId,
      newAssignedToId: command.assignedToId
    }, 'Lead update initiated')

    // Ownership check: Only admin or the assigned/owner user can update
    const isOwner = currentLead.assignedToId === requestingUser.id || currentLead.createdById === requestingUser.id
    const isAdmin = canManageAllLeads(requestingUser.role)
    
    if (!isOwner && !isAdmin) {
      throw new ValidationError('You can only update leads assigned to you or created by you')
    }

    // Validate status transition if changing status
    if (command.status && command.status !== currentLead.status) {
      await this.validateStatusTransition(currentLead.status, command.status)
    }

    // Validate assignee exists if assigning
    if (command.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: command.assignedToId, companyId },
      })
      if (!assignee) {
        throw new NotFoundError('User', command.assignedToId)
      }

      if (command.assignedToId !== requestingUser.id && !isAdmin) {
        throw new ValidationError('You can only assign leads to yourself')
      }
    }

    // Update lead
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(command.name && { name: command.name.trim() }),
        ...(command.phone && { phone: command.phone.trim() }),
        ...(command.email && { email: command.email.toLowerCase().trim() }),
        ...(command.status && { status: command.status as LeadStatus }),
        ...(command.notes !== undefined && { notes: command.notes?.trim() || null }),
        ...(command.assignedToId !== undefined && {
          assignedTo: command.assignedToId
            ? { connect: { id: command.assignedToId } }
            : { disconnect: true },
        }),
        updatedAt: new Date(),
      },
      include: {
        activities: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    log.info({ leadId: id, newStatus: command.status }, 'Lead updated')

    // TODO: Emit event
    // await eventBus.emit('lead.updated', { leadId: id, changes: command })

    return updated as LeadWithRelations
  }

  /**
   * Delete lead (soft delete)
   * 
   * Ownership: Admin can delete any lead, others can only delete their own
   */
  async delete(
    id: string, 
    companyId: string,
    requestingUser: RequestingUser
  ): Promise<void> {
    log.info({ leadId: id, requestingUserId: requestingUser.id }, 'Deleting lead')

    // Get lead with ownership info
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      select: { assignedToId: true, createdById: true }
    })

    if (!lead) {
      throw new NotFoundError('Lead', id)
    }

    // Ownership check
    const isOwner = lead.assignedToId === requestingUser.id || lead.createdById === requestingUser.id
    const isAdmin = canManageAllLeads(requestingUser.role)
    
    if (!isOwner && !isAdmin) {
      throw new ValidationError('You can only delete leads assigned to you or created by you')
    }

    // Soft delete
    await prisma.lead.update({
      where: { id },
      data: { isActive: false },
    })

    log.info({ 
      leadId: id, 
      requestingUserId: requestingUser.id,
      requestingUserRole: requestingUser.role,
      deletedAt: new Date().toISOString()
    }, 'Lead soft deleted')
  }

  /**
   * Validate status transition
   */
  private async validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): Promise<void> {
    const validTransitions: Record<string, string[]> = {
      NEW: ['CONTACTED', 'LOST'],
      CONTACTED: ['VISIT_SCHEDULED', 'LOST'],
      VISIT_SCHEDULED: ['OFFER', 'LOST'],
      OFFER: ['RESERVED', 'LOST'],
      RESERVED: ['SOLD', 'LOST'],
      SOLD: [],
      LOST: ['NEW', 'CONTACTED'], // Can reopen lost leads
    }

    const allowed = validTransitions[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      )
    }
  }

  /**
   * Search leads by name or phone
   */
  async search(
    companyId: string,
    requestingUser: RequestingUser,
    query: string,
    limit: number = 10
  ): Promise<Array<{ id: string; name: string; phone: string; status: string }>> {
    log.debug({ companyId, query }, 'Searching leads')

    const leads = await prisma.lead.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query.replace(/\D/g, '') } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        ...(!canManageAllLeads(requestingUser.role) && {
          AND: [
            {
              OR: [
                { assignedToId: requestingUser.id },
                { createdById: requestingUser.id },
              ],
            },
          ],
        }),
      },
      select: { id: true, name: true, phone: true, status: true },
      take: limit,
    })

    return leads
  }
}

// Export singleton
export const leadService = new LeadService()
