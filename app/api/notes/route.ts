export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { withTenantHandler } from '@/lib/shared/with-tenant'

export const GET = withTenantHandler(withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const notes = await prisma.promissoryNote.findMany({
    where: {
      companyId: user.companyId,
      isActive: true,
      ...(status ? {
        installments: {
          some: { status: status as any }
        }
      } : {})
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      unit: { select: { id: true, title: true } },
      installments: {
        include: {
          payments: true
        },
        orderBy: {
          installmentNumber: 'asc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return successResponse(notes)
}))
