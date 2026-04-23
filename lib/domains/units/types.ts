// lib/domains/units/types.ts

import { Unit, UnitPhoto, UnitAttribute, UnitCostItem } from '@prisma/client'

/**
 * Domain types for Unit entity
 */

export type UnitWithRelations = Unit & {
  photos?: UnitPhoto[]
  attributes?: UnitAttribute[]
  costItems?: UnitCostItem[]
  interestedLeads?: Array<{ id: string; name: string; status: string; phone: string; assignedTo: { name: string } | null }>
}

export type UnitDTO = Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>

export interface CreateUnitCommand {
  title: string
  type: 'CAR' | 'MOTORCYCLE' | 'BOAT'
  priceArs?: number | null
  priceUsd?: number | null
  description?: string
  location?: string
  status?: 'AVAILABLE' | 'IN_PREP' | 'RESERVED' | 'SOLD'
  vin?: string
  domain?: string
  engineNumber?: string
  frameNumber?: string
  hin?: string
  registrationNumber?: string
  tags?: string[]
  photos?: Array<{ url: string; order: number }>
  notes?: string
  companyId: string
  createdById: string
}

export interface UpdateUnitCommand {
  title?: string
  priceArs?: number
  priceUsd?: number
  acquisitionCostArs?: number | null
  acquisitionCostUsd?: number | null
  description?: string
  notes?: string
  status?: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DISCARDED'
}

export interface SearchUnitsFilter {
  page?: number
  limit?: number
  type?: string
  status?: string
  minPrice?: number
  maxPrice?: number
  year?: number
  query?: string
}

export interface UnitListResult {
  units: Array<{
    id: string
    title: string
    type: string
    priceArs: number
    priceUsd: number | null
    location: string | null
    tags: string[]
    createdAt: Date
    status: string
    photoUrl?: string | null
    _count?: { photos: number; interestedLeads: number }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}
export interface AddCostItemCommand {
  concept: string
  amountArs?: number | null
  amountUsd?: number | null
}

export interface UnitCostItemDTO {
  id: string
  concept: string
  amountArs: number | null
  amountUsd: number | null
  date: Date
  unitId: string
}
