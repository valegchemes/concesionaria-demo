export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { createLogger } from '@/lib/shared/logger'
import type { Prisma } from '@prisma/client'

const log = createLogger('SearchRoute')

export const maxDuration = 30

export type SearchResultType = 'LEAD' | 'UNIT' | 'DEAL' | 'USER'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  url: string
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return successResponse([])
  }

  log.debug({ query, companyId: user.companyId }, 'Performing global search')

  const companyId = user.companyId
  // Run all searches in parallel
  const [leads, units, deals, users] = await Promise.all([
    // 1. Search Leads
    prisma.lead.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query.replace(/\D/g, '') } },
        ],
        ...(user.role !== 'ADMIN' && user.role !== 'MANAGER' && {
          AND: [
            {
              OR: [
                { assignedToId: user.id },
                { createdById: user.id },
              ],
            },
          ],
        }),
      },
      take: 5,
      select: { id: true, name: true, email: true, phone: true },
    }),

    // 2. Search Units
    prisma.unit.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { domain: { contains: query, mode: 'insensitive' } },
          { vin: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, title: true, domain: true, priceUsd: true, priceArs: true },
    }),

    // 3. Search Deals
    prisma.deal.findMany({
      where: {
        companyId,
        status: { not: 'CANCELED' },
        ...(user.role !== 'ADMIN' && user.role !== 'MANAGER' && {
          sellerId: user.id,
        }),
        OR: [
          { lead: { name: { contains: query, mode: 'insensitive' } } },
          { unit: { title: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      include: {
        lead: { select: { name: true } },
        unit: { select: { title: true } },
      },
    }),

    // 4. Search Users (Team)
    prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, role: true },
    }),
  ])

  const formatPrice = (price: Prisma.Decimal | number | string | null | undefined) => {
    if (!price) return ''
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(price))
  }

  // Format results
  const results: SearchResult[] = [
    ...leads.map((l) => ({
      id: l.id,
      type: 'LEAD' as SearchResultType,
      title: l.name,
      subtitle: [l.phone, l.email].filter(Boolean).join(' • '),
      url: `/app/leads/${l.id}`,
    })),
    ...units.map((u) => ({
      id: u.id,
      type: 'UNIT' as SearchResultType,
      title: u.title,
      subtitle: u.domain 
        ? `Patente: ${u.domain.toUpperCase()}` 
        : (u.priceUsd ? `USD ${formatPrice(u.priceUsd)}` : (u.priceArs ? `ARS ${formatPrice(u.priceArs)}` : 'Sin precio')),
      url: `/app/units/${u.id}`,
    })),
    ...deals.map((d) => ({
      id: d.id,
      type: 'DEAL' as SearchResultType,
      title: `Operación: ${d.lead.name}`,
      subtitle: d.unit.title,
      url: `/app/deals`,
    })),
    ...users.map((u) => ({
      id: u.id,
      type: 'USER' as SearchResultType,
      title: u.name,
      subtitle: `${u.role} • ${u.email}`,
      url: `/app/team`,
    })),
  ]

  return successResponse(results)
})
