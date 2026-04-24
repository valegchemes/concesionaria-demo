/**
 * Ruta de reparación única: sincroniza el estado de unidades y leads
 * SOLO con deals en estado DELIVERED.
 *
 * También revierte a AVAILABLE las unidades cuyo deal NO es DELIVERED.
 * SEGURIDAD: Solo accesible por ADMIN.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { prisma } from '@/lib/shared/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyId = session.user.companyId

  // 1. Deals DELIVERED → unidad y lead deben ser SOLD
  const deliveredDeals = await prisma.deal.findMany({
    where: { companyId, status: 'DELIVERED' },
    select: { unitId: true, leadId: true },
  })

  const deliveredUnitIds = [...new Set(deliveredDeals.map(d => d.unitId))]
  const deliveredLeadIds = [...new Set(deliveredDeals.map(d => d.leadId))]

  const soldUnits = deliveredUnitIds.length > 0
    ? await prisma.unit.updateMany({
        where: { id: { in: deliveredUnitIds }, companyId },
        data: { status: 'SOLD' },
      })
    : { count: 0 }

  const soldLeads = deliveredLeadIds.length > 0
    ? await prisma.lead.updateMany({
        where: { id: { in: deliveredLeadIds }, companyId },
        data: { status: 'SOLD' },
      })
    : { count: 0 }

  // 2. Deals NO-DELIVERED (activos) → revertir unidad a AVAILABLE si fue marcada como SOLD por error
  const activeDeals = await prisma.deal.findMany({
    where: {
      companyId,
      status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] },
    },
    select: { unitId: true },
  })

  const activeUnitIds = [...new Set(activeDeals.map(d => d.unitId))]
  // Solo revertir las que NO están en la lista de delivered
  const toRevert = activeUnitIds.filter(id => !deliveredUnitIds.includes(id))

  const revertedUnits = toRevert.length > 0
    ? await prisma.unit.updateMany({
        where: { id: { in: toRevert }, companyId, status: 'SOLD' },
        data: { status: 'AVAILABLE' },
      })
    : { count: 0 }

  return NextResponse.json({
    message: 'Sincronización completada.',
    unitsMarkedSold: soldUnits.count,
    leadsMarkedSold: soldLeads.count,
    unitsReverted: revertedUnits.count,
  })
}
