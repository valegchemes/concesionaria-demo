import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
const leadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['INSTAGRAM', 'FACEBOOK_MARKETPLACE', 'REFERRAL', 'WALK_IN', 'PHONE', 'WEBSITE', 'WHATSAPP', 'OLX', 'AUTOSUSADOS', 'OTHER']).default('OTHER'),
  status: z.enum(['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED', 'SOLD', 'LOST']).default('NEW'),
  notes: z.string().optional(),
  quickInfo: z.string().optional(),
  assignedToId: z.string().optional(),
  interestedUnitId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { companyId: session.user.companyId }
    if (status) where.status = status

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: true,
        createdBy: true,
        interestedUnit: true,
        tasks: {
          where: { isCompleted: false },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
        _count: { select: { activities: true, deals: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = leadSchema.parse(body)

    const lead = await prisma.lead.create({
      data: {
        ...validated,
        companyId: session.user.companyId,
        createdById: session.user.id,
      },
      include: {
        assignedTo: true,
        interestedUnit: true,
      },
    })

    // Create initial activity
    await prisma.leadActivity.create({
      data: {
        type: 'NOTE_ADDED',
        notes: 'Lead creado',
        leadId: lead.id,
        createdById: session.user.id,
        companyId: session.user.companyId,
      },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
