import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
const photoSchema = z.object({
  url: z.string(),
  order: z.number().default(0),
})

const unitSchema = z.object({
  type: z.enum(['CAR', 'MOTORCYCLE', 'BOAT']),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD']).default('AVAILABLE'),
  location: z.string().optional(),
  tags: z.array(z.string()).default([]),
  priceArs: z.number().optional(),
  priceUsd: z.number().optional(),
  vin: z.string().optional(),
  domain: z.string().optional(),
  engineNumber: z.string().optional(),
  frameNumber: z.string().optional(),
  hin: z.string().optional(),
  registrationNumber: z.string().optional(),
  acquisitionCostArs: z.number().optional(),
  acquisitionCostUsd: z.number().optional(),
  acquisitionType: z.enum(['PURCHASE', 'TRADE_IN', 'CONSIGNMENT']).default('PURCHASE'),
  photos: z.array(photoSchema).max(5).default([]),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const minimal = searchParams.get('minimal') === 'true'

    const where: any = { companyId: session.user.companyId }
    if (status) where.status = status
    if (type) where.type = type

    if (minimal) {
      const units = await prisma.unit.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priceArs: true,
          priceUsd: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(units)
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        photos: { orderBy: { order: 'asc' } },
        attributes: true,
        _count: { select: { interestedLeads: true } }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = unitSchema.parse(body)

    const unit = await prisma.unit.create({
      data: {
        ...validated,
        companyId: session.user.companyId,
        photos: {
          create: validated.photos?.map((p, i) => ({ url: p.url, order: i })) || []
        },
      },
      include: {
        photos: { orderBy: { order: 'asc' } },
        attributes: true,
        _count: { select: { interestedLeads: true } }
      },
    })

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Failed to create unit - database not connected' }, { status: 500 })
  }
}
