export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:Me')

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    const user = await prisma.user.findFirst({
      where: {
        id: currentUser.id,
        companyId: currentUser.companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        whatsappNumber: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            whatsappCentral: true,
          },
        },
      },
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      whatsappNumber: user.whatsappNumber,
      companyId: user.company.id,
      companyName: user.company.name,
      companySlug: user.company.slug,
      whatsappCentral: user.company.whatsappCentral,
    })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch current user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
