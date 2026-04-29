export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '../auth/[...nextauth]/auth-options'
import { hashPassword } from '@/lib/auth'
import { createLogger } from '@/lib/shared/logger'
import { requirePermission, getCurrentUser } from '@/lib/shared/auth-helpers'
import { createAuditLog } from '@/lib/shared/audit-log'
import { EmailSchema, NameSchema, PasswordSchema, PhoneSchema } from '@/lib/shared/validation'
import { z } from 'zod'

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
    const body = await request.json()

    const CreateUserSchema = z.object({
      name: NameSchema,
      email: EmailSchema,
      password: PasswordSchema,
      role: z.enum(['ADMIN', 'MANAGER', 'SELLER']).optional(),
      whatsappNumber: PhoneSchema.optional().or(z.literal('')),
    })

    const parsed = CreateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
    }

    const currentUser = await requirePermission('team', 'manage_all')
    const { name, email, password, role, whatsappNumber } = parsed.data

    // Check if user already exists in this company
    const existingUser = await prisma.user.findUnique({
      where: {
        email_companyId: {
          email,
          companyId: currentUser.companyId,
        },
      },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists in your company' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'SELLER',
        whatsappNumber,
        companyId: currentUser.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    await createAuditLog({
      action: 'create',
      resource: 'User',
      resourceId: user.id,
      after: user,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: currentUser.companyId,
      userId: currentUser.id,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating user')
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    const requestingUserId = currentUser.id
    const companyId = currentUser.companyId

    // RBAC check: only users with team:manage_all permission can delete users
    await requirePermission('team', 'manage_all')

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

    await createAuditLog({
      action: 'deactivate',
      resource: 'User',
      resourceId: userId,
      before: user,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
      companyId: companyId,
      userId: requestingUserId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error deleting user')
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
