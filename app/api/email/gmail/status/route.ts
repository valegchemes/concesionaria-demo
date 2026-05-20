export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    
    const connection = await prisma.gmailConnection.findUnique({
      where: { companyId: session.user.companyId }
    })

    const interactions = await prisma.emailInteraction.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({ 
      connected: !!connection,
      emailAddress: connection?.emailAddress || null,
      interactions 
    })
  } catch (error) {
    console.error('Error fetching Gmail status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
