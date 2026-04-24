export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { RegisterCompanySchema } from '@/lib/shared/validation'
import { checkRateLimit, rateLimitStore } from '@/lib/rate-limit'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:Register')

const REGISTER_RATE_LIMIT = 3
const REGISTER_WINDOW_MS = 15 * 60 * 1000

function checkRegisterRateLimit(ip: string): boolean {
  const key = `register:${ip}`
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + REGISTER_WINDOW_MS })
    return true
  }

  if (record.count >= REGISTER_RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'

    if (!checkRegisterRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
        { status: 429 }
      )
    }
    
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
      return NextResponse.json({ error: 'El slug "'+slug+'" ya está en uso. Por favor elige otro.' }, { status: 400 })
    }

    const hashedPassword = await hash(password, 10)

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
          }
        }
      }
    })

    return NextResponse.json({ success: true, companyId: company.id }, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Registration Error')
    return NextResponse.json({ error: 'Fallo al procesar el registro' }, { status: 500 })
  }
}
