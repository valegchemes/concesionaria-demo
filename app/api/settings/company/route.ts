export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'

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

    const body = await request.json()
    // Solo permitimos editar campos seguros (slug preferimos no editarlo tras crearlo para no romper URLs, pero puede permitirse si se valida bien)
    const { name, phone, email, whatsappCentral, address, city, currencyPreference, logoUrl } = body

    const updatedCompany = await prisma.company.update({
      where: { id: session.user.companyId },
      data: {
        name,
        phone,
        email,
        whatsappCentral,
        address,
        city,
        currencyPreference,
        ...(logoUrl !== undefined && { logoUrl })
      }
    })

    return NextResponse.json(updatedCompany, { status: 200 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Settings Update Error')
    return NextResponse.json({ error: 'Failed to update company settings' }, { status: 500 })
  }
}
