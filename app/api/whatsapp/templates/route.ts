export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { WhatsAppTemplateSchema } from '@/lib/shared/validation'

const log = createLogger('API:WhatsAppTemplates')

export async function GET() {
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
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await request.json()
    
    // ✅ TAREA 2: Validar input con Zod
    const validationResult = WhatsAppTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, template, isDefault } = validationResult.data

    const created = await prisma.whatsAppTemplate.create({
      data: {
        name,
        template,
        isDefault,
        companyId: session.user.companyId,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating template')
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
