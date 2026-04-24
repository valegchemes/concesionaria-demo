/**
 * Ruta de reparación única: sincroniza el estado de unidades y leads
 * con el estado real de sus deals completados (DELIVERED / APPROVED).
 *
 * SEGURIDAD: Solo accesible por ADMIN. Borrar este archivo luego de usarlo.
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

  // Buscar todos los deals DELIVERED o APPROVED de esta empresa
  const closedDeals = await prisma.deal.findMany({
    where: {
      companyId,
      status: { in: ['DELIVERED', 'APPROVED'] },
    },
    select: { unitId: true, leadId: true },
  })

  if (closedDeals.length === 0) {
    return NextResponse.json({ message: 'No hay deals cerrados para sincronizar.', updated: 0 })
  }

  const unitIds = [...new Set(closedDeals.map(d => d.unitId))]
  const leadIds = [...new Set(closedDeals.map(d => d.leadId))]

  // Actualizar unidades → SOLD
  const unitsResult = await prisma.unit.updateMany({
    where: { id: { in: unitIds }, companyId },
    data: { status: 'SOLD' },
  })

  // Actualizar leads → SOLD
  const leadsResult = await prisma.lead.updateMany({
    where: { id: { in: leadIds }, companyId },
    data: { status: 'SOLD' },
  })

  return NextResponse.json({
    message: 'Sincronización completada.',
    unitsUpdated: unitsResult.count,
    leadsUpdated: leadsResult.count,
  })
}
