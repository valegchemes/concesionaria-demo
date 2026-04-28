export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'
import { applyRateLimit } from '@/lib/rate-limit-kv'
import { UpdateCompanySchema } from '@/lib/shared/validation'
import { z } from 'zod'

const log = createLogger('API:CompanySettings')

export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting estricto para mutaciones críticas
    const rateLimitResponse = await applyRateLimit(request, { strict: true })
    if (rateLimitResponse) return rateLimitResponse

    // Only admins can modify company settings
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only admins can modify company settings.' }, { status: 403 })
    }

    const body = await request.json()
    const data = UpdateCompanySchema.parse(body)

    const updatedCompany = await prisma.company.update({
      where: { id: session.user.companyId },
      data
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
