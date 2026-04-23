export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '../../../auth/[...nextauth]/auth-options'
import { z } from 'zod'

const taskSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().datetime(),
  assignedToId: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify lead belongs to company
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
    const validated = taskSchema.parse(body)

    const task = await prisma.task.create({
      data: {
        ...validated,
        leadId: id,
        companyId: session.user.companyId,
        assignedToId: validated.assignedToId || session.user.id,
      },
      include: {
        assignedTo: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }

    const { id } = await params

    const body = await request.json()
    const { isCompleted } = body

    const task = await prisma.task.updateMany({
      where: {
        id: taskId,
        leadId: id,
        companyId: session.user.companyId,
      },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, count: task.count })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
