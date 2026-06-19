export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:DashboardStats')

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const user = await getCurrentUser()
  const companyId = user.companyId
  const userId = user.id
  const isSeller = user.role === 'SELLER'
  const leadWhere = isSeller ? { companyId, assignedToId: userId } : { companyId }
  const dealWhere = isSeller ? { companyId, sellerId: userId } : { companyId }

  const [
    totalLeads, activeLeads, newLeads, lostLeads,
    totalUnits, availableUnits, soldUnits,
    tradeInTotal, tradeInSold, pendingTradeIns,
    activeDeals, completedDeals, canceledDeals,
    paidInstallmentsThisMonth, pendingInstallments, overdueInstallments,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'NEW' } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId, isActive: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'SOLD' } }),
    prisma.unit.count({ where: { companyId, isActive: true, isFromTradeIn: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, isFromTradeIn: true, status: 'SOLD' } }),
    prisma.tradeIn.count({ where: { deal: { companyId }, isConverted: false } }),
    prisma.deal.count({ where: { ...dealWhere, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'DELIVERED' } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'CANCELED' } }),
    prisma.installmentPayment.findMany({
      where: {
        installment: { promissoryNote: { companyId } },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amount: true },
    }),
    prisma.installment.findMany({
      where: { status: 'PENDING', promissoryNote: { companyId } },
      select: { amount: true },
    }),
    prisma.installment.findMany({
      where: { status: 'OVERDUE', promissoryNote: { companyId } },
      select: { amount: true },
    }),
  ])

  const collectedArs = paidInstallmentsThisMonth.reduce(
    (sum, p) => sum + Number(p.amount), 0
  )
  const pendingArs = pendingInstallments.reduce(
    (sum, i) => sum + Number(i.amount), 0
  )
  const overdueArs = overdueInstallments.reduce(
    (sum, i) => sum + Number(i.amount), 0
  )

  let sellerCommission = null

  if (isSeller) {
    const sellerInfo = await prisma.user.findUnique({
      where: { id: userId },
      select: { commissionRate: true }
    })
    const commissionRate = Number(sellerInfo?.commissionRate || 0)

    const sellerDeals = await prisma.deal.findMany({
      where: {
        ...dealWhere,
        status: { in: ['DELIVERED', 'NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] }
      },
      select: { status: true, finalPrice: true, finalPriceCurrency: true, commissionValue: true }
    })

    let commissionArs = 0, commissionUsd = 0
    let pendingCommissionArs = 0, pendingCommissionUsd = 0

    for (const d of sellerDeals) {
      const finalPrice = Number(d.finalPrice)
      let comm = Number(d.commissionValue || 0)
      if (comm === 0 && commissionRate > 0) {
        comm = finalPrice * (commissionRate / 100)
      }
      if (d.status === 'DELIVERED') {
        if (d.finalPriceCurrency === 'USD') commissionUsd += comm
        else commissionArs += comm
      } else {
        if (d.finalPriceCurrency === 'USD') pendingCommissionUsd += comm
        else pendingCommissionArs += comm
      }
    }

    sellerCommission = { commissionRate, commissionArs, commissionUsd, pendingCommissionArs, pendingCommissionUsd }
  }

  // Obtener nombre de la compañía y plan limits
  const [company, planLimits] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    }),
    import('@/lib/shared/plan-limits').then(m => m.getPlanLimits(companyId)),
  ])

  return successResponse({
    companyName: company?.name,
    analyticsEnabled: planLimits.analyticsEnabled,
    userRole: user.role,
    stats: {
      leads: { total: totalLeads, active: activeLeads, new: newLeads, lost: lostLeads },
      units: { total: totalUnits, available: availableUnits, sold: soldUnits, tradeInTotal, tradeInSold, pendingTradeIns },
      deals: { active: activeDeals, completed: completedDeals, canceled: canceledDeals },
      notes: { collectedArs, pendingArs, overdueArs },
      sellerCommission,
    },
  })
})
