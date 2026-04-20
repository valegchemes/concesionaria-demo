import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      companyName, slug, companyPhone, companyEmail,
      adminName, adminEmail, password 
    } = body

    if (!companyName || !slug || !adminName || !adminEmail || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

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
    console.error('Registration Error:', error)
    return NextResponse.json({ error: 'Fallo al procesar el registro' }, { status: 500 })
  }
}
