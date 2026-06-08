import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'
import type { Prisma } from '@prisma/client'

const log = createLogger('API:Documents')

const VALID_DOC_TYPES = ['BOLETO_COMPRAVENTA', 'RECIBO', 'CONTRATO'] as const
type ValidDocType = typeof VALID_DOC_TYPES[number]

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')

    const where: Prisma.DigitalDocumentWhereInput = { companyId: session.user.companyId }
    if (type) {
      if (!VALID_DOC_TYPES.includes(type as ValidDocType)) {
        return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
      }
      where.type = type as ValidDocType
    }

    const docs = await prisma.digitalDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        unit: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ data: docs })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching documents')
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
