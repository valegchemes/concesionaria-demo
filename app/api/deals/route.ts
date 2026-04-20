import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'

const dealSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().min(1),
  sellerId: z.string().min(1),
  finalPrice: z.number().min(0),
  finalPriceCurrency: z.enum(['ARS', 'USD']).default('ARS'),
  status: z.enum(['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED']).default('NEGOTIATION'),
  depositAmount: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { companyId: session.user.companyId }
    if (status) where.status = status

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: { select: { name: true, phone: true } },
        unit: { select: { title: true, type: true } },
        seller: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = dealSchema.parse(body)

    // Inicamos transacción para crear Deal y cambiar estado de Unidad si es necesario
    const deal = await prisma.$transaction(async (tx) => {
      const newDeal = await tx.deal.create({
        data: {
          ...validated,
          companyId: session.user.companyId,
        },
        include: {
          lead: true,
          unit: true,
        }
      })

      // Si el deal está en RESERVED o DELIVERED, actualizamos el status de la unidad
      if (validated.status === 'RESERVED') {
        await tx.unit.update({
          where: { id: validated.unitId },
          data: { status: 'RESERVED' }
        })
      } else if (validated.status === 'DELIVERED') {
        await tx.unit.update({
          where: { id: validated.unitId },
          data: { status: 'SOLD' }
        })
      }

      // Registrar actividad en el Lead
      await tx.leadActivity.create({
        data: {
          type: 'OFFER_RECEIVED',
          notes: `Operación creada: ${validated.status} por ${validated.finalPriceCurrency} ${validated.finalPrice}`,
          leadId: validated.leadId,
          createdById: session.user.id,
          companyId: session.user.companyId,
        }
      })

      return newDeal
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating deal:', error)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
