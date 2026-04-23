import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
const activitySchema = z.object({
  type: z.enum(['WHATSAPP_SENT', 'CALL_MADE', 'CALL_RECEIVED', 'VISIT_DONE', 'OFFER_RECEIVED', 'EMAIL_SENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'TASK_COMPLETED']),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify lead exists
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const body = await request.json()
    const validated = activitySchema.parse(body)

    const activity = await prisma.leadActivity.create({
      data: {
        ...validated,
        leadId: id,
        createdById: session.user.id,
        companyId: session.user.companyId,
      },
      include: {
        createdBy: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
