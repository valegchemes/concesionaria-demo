export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '../../auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:WhatsAppTemplates')

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, template, isDefault = false } = body

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
