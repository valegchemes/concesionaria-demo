export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { RegisterCompanySchema } from '@/lib/shared/validation'
import { applyRateLimit } from '@/lib/rate-limit-kv'
import { createLogger } from '@/lib/shared/logger'
import { createAuditLog } from '@/lib/shared/audit-log'
import { Prisma } from '@prisma/client'

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

    const hashedPassword = await hashPassword(password)

    let company: Awaited<ReturnType<typeof prisma.company.create>>
    try {
      company = await prisma.company.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: `El slug "${slug}" ya está en uso. Por favor elige otro.` },
          { status: 409 }
        )
      }
      throw error
    }

    const users = (company as unknown as { users: Array<{ id: string; name: string; email: string }> }).users
    const admin = users[0]

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