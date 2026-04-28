// lib/domains/deals/types.ts

import { Deal, DealPayment, DealCostItem, TradeIn } from '@prisma/client'

/**
 * Domain types for Deal entity
 */

export type DealWithRelations = Deal & {
  lead?: { id: string; name: string; phone: string }
  unit?: { id: string; title: string; type: string }
  payments?: DealPayment[]
  closingCosts?: DealCostItem[]
  tradeIn?: TradeIn | null
  seller?: { id: string; name: string; email: string } | null
}

export type DealDTO = Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>

export interface CreateDealCommand {
  leadId: string
  unitId: string
  sellerId: string
  finalPrice: number
  finalPriceCurrency: string
  status: 'NEGOTIATION' | 'RESERVED' | 'APPROVED' | 'IN_PAYMENT' | 'DELIVERED' | 'CANCELED'
  depositAmount?: number
  notes?: string
  companyId: string
  createdById: string
}

export interface RequestingUser {
  id: string
  role: string
  /** Resolved RBAC permissions ("resource:action" strings). */
  permissions: string[]
}

export interface UpdateDealCommand {
  status?: 'NEGOTIATION' | 'RESERVED' | 'APPROVED' | 'IN_PAYMENT' | 'DELIVERED' | 'CANCELED'
  notes?: string
  finalPrice?: number
  finalPriceCurrency?: string
}

export interface RecordPaymentCommand {
  amount: number
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CARD' | 'FINANCING'
  reference?: string
  notes?: string
}

export interface AddCostItemCommand {
  description: string  // maps to 'concept' in Prisma
  amount: number       // maps to 'amountArs' in Prisma
}

export interface DealSummary {
  dealId: string
  grossAmount: number
  totalPayments: number
  remainingBalance: number
  totalCosts: number
  netAmount: number
  paymentCount: number
  costItemCount: number
}

export interface DealListResult {
  deals: Array<{
    id: string
    status: string
    grossAmount: number
    finalPrice: number
    finalPriceCurrency: string
    lead?: { name: string; phone: string }
    unit?: { title: string; type: string }
    seller?: { name: string }
    createdAt: Date
    _count?: { payments: number; costItems: number }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}
