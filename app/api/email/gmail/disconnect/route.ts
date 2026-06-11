export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/prisma'
import { getOAuth2Client } from '@/lib/email/gmail'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:GmailDisconnect')

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    
    const connection = await prisma.gmailConnection.findUnique({
      where: { companyId: session.user.companyId }
    })

    if (connection) {
      // Try to revoke on Google's side (use legacy refreshToken if available)
      const legacyRefreshToken = connection.refreshToken
      if (legacyRefreshToken) {
        try {
          const oAuth2Client = getOAuth2Client()
          await oAuth2Client.revokeToken(legacyRefreshToken)
        } catch (revokeErr) {
          log.warn({ err: String(revokeErr) }, 'Failed to revoke token on Google, proceeding with local deletion')
        }
      }

      // Delete from local DB
      await prisma.gmailConnection.delete({
        where: { companyId: session.user.companyId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, 'Error disconnecting Gmail')
    return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 })
  }
}
