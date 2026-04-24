export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '../auth/[...nextauth]/auth-options'
import { hash } from 'bcryptjs'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:Users')

export const maxDuration = 30
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      where: {
        companyId: session.user.companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        whatsappNumber: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching users')
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can create users.' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, password, role, whatsappNumber } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing name, email or password' }, { status: 400 })
    }

    // Check if user already exists in this company
    const existingUser = await prisma.user.findUnique({
      where: {
        email_companyId: {
          email,
          companyId: session.user.companyId,
        },
      },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists in your company' }, { status: 400 })
    }

    const hashedPassword = await hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'SELLER',
        whatsappNumber,
        companyId: session.user.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating user')
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
