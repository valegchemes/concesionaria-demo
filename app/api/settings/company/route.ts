export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { createAuditLog } from '@/lib/shared/audit-log'
import { requirePermission } from '@/lib/shared/auth-helpers'
import { applyRateLimit } from '@/lib/rate-limit-kv'
import { UpdateCompanySchema } from '@/lib/shared/validation'
import { z } from 'zod'

const log = createLogger('API:CompanySettings')

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requirePermission('settings', 'read')

    const company = await prisma.company.findUnique({
      where: { id: currentUser.companyId },
      select: {
        name: true,
        phone: true,
        email: true,
        whatsappCentral: true,
        address: true,
        city: true,
        currencyPreference: true,
        logoUrl: true,
      }
    })

    return NextResponse.json(company)
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Settings Fetch Error')
    return NextResponse.json({ error: 'Failed to fetch company settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requirePermission('settings', 'manage')

    // Rate limiting estricto para mutaciones críticas
    const rateLimitResponse = await applyRateLimit(request, { strict: true })
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const data = UpdateCompanySchema.parse(body)

    const before = await prisma.company.findUnique({
      where: { id: currentUser.companyId },
      select: {
        name: true,
        phone: true,
        email: true,
        whatsappCentral: true,
        address: true,
        city: true,
        currencyPreference: true,
        logoUrl: true,
      },
    })

    const updatedCompany = await prisma.company.update({
      where: { id: currentUser.companyId },
      data
    })

    await createAuditLog({
      action: 'update',
      resource: 'Company',
      resourceId: currentUser.companyId,
      before,
      after: updatedCompany,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: currentUser.companyId,
      userId: currentUser.id,
    })

    return NextResponse.json(updatedCompany, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Settings Update Error')
    return NextResponse.json({ error: 'Failed to update company settings' }, { status: 500 })
  }
}
