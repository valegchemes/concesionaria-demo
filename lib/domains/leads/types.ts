// lib/domains/leads/types.ts

import { Lead, LeadActivity } from '@prisma/client'

/**
 * Domain types for Lead entity
 * These extend Prisma types with additional business logic types
 */

export type LeadWithRelations = Lead & {
  activities: LeadActivity[]
  assignedTo?: { id: string; name: string; email: string } | null
  createdBy?: { id: string; name: string } | null
  interestedUnit?: { id: string; title: string } | null
}

export type LeadDTO = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>

export interface CreateLeadCommand {
  name: string
  phone: string
  email?: string
  source: string
  notes?: string
  companyId: string
  createdById: string
}

export interface UpdateLeadCommand {
  status?: string
  assignedToId?: string | null
  notes?: string
  name?: string
  email?: string
  phone?: string
}

export interface LeadNotification {
  type: 'LEAD_CREATED' | 'LEAD_ASSIGNED' | 'LEAD_STATUS_CHANGED'
  leadId: string
  companyId: string
  userId?: string
  message: string
}
