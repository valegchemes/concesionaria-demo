import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
const photoSchema = z.object({
  url: z.string(),
  order: z.number().default(0),
})

const unitUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD']).optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
  acquisitionType: z.enum(['PURCHASE', 'TRADE_IN', 'CONSIGNMENT']).optional(),
  photos: z.array(photoSchema).max(5).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
      include: {
        photos: { orderBy: { order: 'asc' } },
        attributes: true,
        interestedLeads: {
          include: {
            assignedTo: true,
          },
        },
        costItems: true,
        deals: {
          include: {
            lead: true,
            seller: true,
          },
        },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error('Error fetching unit:', error)
    return NextResponse.json({ error: 'Database not connected' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify unit belongs to company
    const existingUnit = await prisma.unit.findFirst({
      where: { id, companyId: session.user.companyId }
    })
    if (!existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = unitUpdateSchema.parse(body)

    // Update photos if provided
    if (validated.photos) {
      await prisma.unitPhoto.deleteMany({
        where: { unitId: id }
      })
      await prisma.unitPhoto.createMany({
        data: validated.photos.map((p, i) => ({
          unitId: id,
          url: p.url,
          order: i,
        }))
      })
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: {
        title: validated.title,
        description: validated.description,
        status: validated.status,
        location: validated.location,
        tags: validated.tags,
        priceArs: validated.priceArs,
        priceUsd: validated.priceUsd,
        vin: validated.vin,
        domain: validated.domain,
        engineNumber: validated.engineNumber,
        frameNumber: validated.frameNumber,
        hin: validated.hin,
        registrationNumber: validated.registrationNumber,
        acquisitionCostArs: validated.acquisitionCostArs,
        acquisitionCostUsd: validated.acquisitionCostUsd,
        acquisitionType: validated.acquisitionType,
      },
      include: {
        photos: { orderBy: { order: 'asc' } },
        attributes: true,
      },
    })

    return NextResponse.json(unit)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating unit:', error)
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify unit belongs to company
    const existingUnit = await prisma.unit.findFirst({
      where: { id, companyId: session.user.companyId }
    })
    if (!existingUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    await prisma.unit.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
  }
}
