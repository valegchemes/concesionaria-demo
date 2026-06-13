export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { decryptEmailField } from '@/lib/shared/email-crypto'

const log = createLogger('API:GmailStatus')

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

    // Decrypt fields for the response
    const decryptedInteractions = interactions.map(interaction => ({
      ...interaction,
      messageBody: decryptEmailField(interaction.messageBodyEnc),
      replyBody: decryptEmailField(interaction.replyBodyEnc),
    }))

    return NextResponse.json({ 
      connected: !!connection,
      emailAddress: connection?.emailAddress || null,
      interactions: decryptedInteractions 
    })
  } catch (error) {
    log.error({ err: String(error) }, 'Error fetching Gmail status')
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
