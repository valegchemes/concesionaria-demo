export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { compare, hash } from 'bcryptjs'
import { createLogger } from '@/lib/shared/logger'
import { z } from 'zod'

const log = createLogger('API:UserSettings')

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  currentPassword: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = UpdateUserSchema.parse(body)

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, password: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isChangingSensitiveField =
      (data.email && data.email !== currentUser.email) ||
      Boolean(data.password)

    if (isChangingSensitiveField) {
      if (!data.currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change email or password' },
          { status: 400 }
        )
      }

      const isValidCurrentPassword = await compare(data.currentPassword, currentUser.password)
      if (!isValidCurrentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    if (data.email && data.email !== currentUser.email) {
      const emailInUse = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: session.user.id },
        },
        select: { id: true },
      })

      if (emailInUse) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
      }
    }

    const updateData: Record<string, string | null | undefined> = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl
    
    // Si envían password, significa que quieren cambiarla
    if (data.password) {
      updateData.password = await hash(data.password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true } // Excluir password en la respuesta
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Settings Update Error')
    return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 })
  }
}
