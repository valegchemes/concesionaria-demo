export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { WhatsAppTemplateSchema } from '@/lib/shared/validation'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const log = createLogger('API:WhatsAppTemplates')

export const GET = withTenantHandler(async () => {
  try {
    const session = await requireAuth()
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching templates')
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
})

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const validationResult = WhatsAppTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, template, isDefault } = validationResult.data

    const created = await prisma.whatsAppTemplate.create({
      data: { name, template, isDefault, companyId: session.user.companyId },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating template')
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
})
