export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createLogger } from '@/lib/shared/logger'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const log = createLogger('API:LeadActivities')

const activitySchema = z.object({
  type: z.enum(['WHATSAPP_SENT', 'CALL_MADE', 'CALL_RECEIVED', 'VISIT_DONE', 'OFFER_RECEIVED', 'EMAIL_SENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'TASK_COMPLETED']),
  notes: z.string().optional(),
})

export const POST = withTenantHandler(async (
  request: NextRequest,
  context?: unknown
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  try {
    const session = await requireAuth()

    const lead = await prisma.lead.findFirst({
      where: { id, companyId: session.user.companyId },
      select: { assignedToId: true, createdById: true },
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
    const validated = activitySchema.parse(body)

    const activity = await prisma.leadActivity.create({
      data: {
        ...validated,
        leadId: id,
        createdById: session.user.id,
        companyId: session.user.companyId,
      },
      include: { createdBy: { select: { name: true } } },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating activity')
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
})
