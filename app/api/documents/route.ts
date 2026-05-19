import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')

    const where: any = { companyId: session.user.companyId }
    if (type) {
      where.type = type
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
    console.error('[DOCUMENTS_GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
