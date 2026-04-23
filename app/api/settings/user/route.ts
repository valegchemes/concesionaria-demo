export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { hash } from 'bcryptjs'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, password, avatarUrl } = body

    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    
    // Si envían password, significa que quieren cambiarla
    if (password) {
      updateData.password = await hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true } // Excluir password en la respuesta
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    console.error('Settings Update Error:', error)
    return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 })
  }
}
