export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '../../../auth/[...nextauth]/auth-options'
import { z } from 'zod'
import { createLogger } from '@/lib/shared/logger'
import { ValidationError } from '@/lib/shared/errors'
import { UpdateTaskSchema } from '@/lib/shared/validation'

const log = createLogger('API:Tasks')

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

    // Verify lead belongs to company and user can access it
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
      select: {
        id: true,
        assignedToId: true,
        createdById: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const canManageAll = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'
    const canAccessLead =
      canManageAll ||
      lead.assignedToId === session.user.id ||
      lead.createdById === session.user.id

    if (!canAccessLead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validated = taskSchema.parse(body)

    if (
      validated.assignedToId &&
      validated.assignedToId !== session.user.id &&
      !canManageAll
    ) {
      throw new ValidationError('You can only assign tasks to yourself')
    }

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
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating task')
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
    
    // ✅ TAREA 2: Validar input con Zod
    const validationResult = UpdateTaskSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { isCompleted } = validationResult.data

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
      select: {
        assignedToId: true,
        createdById: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const canManageAll = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'
    const canAccessLead =
      canManageAll ||
      lead.assignedToId === session.user.id ||
      lead.createdById === session.user.id

    if (!canAccessLead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error updating task')
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
