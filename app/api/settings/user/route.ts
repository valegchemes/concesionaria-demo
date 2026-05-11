export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { compare, hash } from 'bcryptjs'
import { createLogger } from '@/lib/shared/logger'
import { successResponse, errorResponse } from '@/lib/shared/api-response'
import { z } from 'zod'
import { withTenantHandler } from '@/lib/shared/with-tenant'

const log = createLogger('API:UserSettings')

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  currentPassword: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  exchangeRateArsPerUsd: z.preprocess((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') return null
      const parsed = Number(trimmed.replace(',', '.'))
      return Number.isFinite(parsed) ? parsed : value
    }
    return value
  }, z.number().positive().nullable()).optional(),
})

export const PATCH = withTenantHandler(async (request: NextRequest) => {
  try {
    const session = await requireAuth()

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

    const updateData: Record<string, string | number | null | undefined> = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl
    if (data.exchangeRateArsPerUsd !== undefined) updateData.exchangeRateArsPerUsd = data.exchangeRateArsPerUsd
    
    // Si envían password, significa que quieren cambiarla
    if (data.password) {
      updateData.password = await hash(data.password, 12) // cost factor 12: consistente con lib/auth.ts
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, exchangeRateArsPerUsd: true } // Excluir password en la respuesta
    })

    return successResponse(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error)
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Settings Update Error')
    return errorResponse(new Error('Failed to update user settings'))
  }
})
