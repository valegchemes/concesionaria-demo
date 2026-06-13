export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import type { InstallmentStatus } from '@prisma/client'

const AllowedInstallmentStatus = z.enum(['PENDING', 'PAID', 'OVERDUE'])

export const GET = withTenantHandler(withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  
  // Validar status con Zod en lugar de castear a any
  const validatedStatus = statusParam 
    ? AllowedInstallmentStatus.safeParse(statusParam).data ?? undefined
    : undefined

  const notes = await prisma.promissoryNote.findMany({
    where: {
      companyId: user.companyId,
      isActive: true,
      ...(validatedStatus ? {
        installments: {
          some: { status: validatedStatus }
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
