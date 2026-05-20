export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getOAuth2Client } from '@/lib/email/gmail'

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    
    const connection = await prisma.gmailConnection.findUnique({
      where: { companyId: session.user.companyId }
    })

    if (connection) {
      // Try to revoke on Google's side
      try {
        const oAuth2Client = getOAuth2Client()
        await oAuth2Client.revokeToken(connection.refreshToken)
      } catch (revokeErr) {
        console.warn('Failed to revoke token on Google, proceeding with local deletion', revokeErr)
      }

      // Delete from local DB
      await prisma.gmailConnection.delete({
        where: { companyId: session.user.companyId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Gmail:', error)
    return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 })
  }
}
