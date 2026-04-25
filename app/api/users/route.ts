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

export async function DELETE(request: NextRequest) {
  try {
    // Auth via middleware headers (consistent with the rest of the API)
    const requestingUserId = request.headers.get('x-user-id')
    const requestingUserRole = request.headers.get('x-user-role')
    const companyId = request.headers.get('x-company-id')

    if (!requestingUserId || !companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (requestingUserRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar miembros.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    if (userId === requestingUserId) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, companyId, isActive: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error deleting user')
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
