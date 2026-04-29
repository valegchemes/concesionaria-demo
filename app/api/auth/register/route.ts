export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { RegisterCompanySchema } from '@/lib/shared/validation'
import { applyRateLimit } from '@/lib/rate-limit-kv'
import { createLogger } from '@/lib/shared/logger'
import { createAuditLog } from '@/lib/shared/audit-log'

const log = createLogger('AuthRegisterRoute')

export async function POST(request: NextRequest) {
  try {
    const blocked = await applyRateLimit(request, { strict: true, path: '/api/auth/register' })
    if (blocked) return blocked
    
    const body = await request.json()
    
    const validation = RegisterCompanySchema.safeParse(body)
    
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      return NextResponse.json({ error: firstError?.message || 'Datos inválidos' }, { status: 400 })
    }

    const { 
      companyName, slug, companyPhone, companyEmail,
      adminName, adminEmail, password 
    } = validation.data

    // Comprobar si el slug o el correo del admin ya existen (slug debe ser único, adminEmail puede ser repetido en diferentes empresas pero simplificaremos aquí o mejor solo buscar si existe el slug)
    const existingSlug = await prisma.company.findUnique({
      where: { slug }
    })

    if (existingSlug) {
      return NextResponse.json(
        { error: `El slug "${slug}" ya está en uso. Por favor elige otro.` },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    // Crear la compañia y su admin en una transacción (pero usaremos un create anidado para mayor simplicidad)
    const company = await prisma.company.create({
      data: {
        name: companyName,
        slug: slug,
        phone: companyPhone || '',
        email: companyEmail || '',
        users: {
          create: {
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
          },
        },
      },
      include: {
        users: true,
      },
    })

    const admin = company.users[0]

    await createAuditLog({
      action: 'create',
      resource: 'Company',
      resourceId: company.id,
      after: {
        id: company.id,
        slug: company.slug,
        name: company.name,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: company.id,
      userId: admin?.id ?? company.id,
    })

    return NextResponse.json({ success: true, companyId: company.id }, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Registration error')
    return NextResponse.json({ error: 'Fallo al procesar el registro' }, { status: 500 })
  }
}
