export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client, verifyOAuthState } from '@/lib/email/gmail'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { encrypt } from '@/lib/shared/crypto'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:GmailCallback')

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 })
    }

    // Verify signed OAuth state to prevent CSRF and token injection attacks
    const companyId = verifyOAuthState(state)
    if (!companyId) {
      log.warn({ state: state.slice(0, 20) }, 'Invalid OAuth state signature - possible CSRF attack')
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 403 })
    }

    const oAuth2Client = getOAuth2Client()
    const { tokens } = await oAuth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
       return NextResponse.json({ error: 'Failed to retrieve all required tokens (refresh token may be missing)' }, { status: 400 })
    }

    oAuth2Client.setCredentials(tokens)

    // Get user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client })
    const userInfo = await oauth2.userinfo.get()
    const emailAddress = userInfo.data.email

    if (!emailAddress) {
       return NextResponse.json({ error: 'Could not retrieve email address from Google' }, { status: 400 })
    }

    // Save to NEW encrypted fields
    const accessTokenEnc = encrypt(tokens.access_token!)
    const refreshTokenEnc = encrypt(tokens.refresh_token!)

    await prisma.gmailConnection.upsert({
      where: { companyId },
      update: {
        emailAddress,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiry: new Date(tokens.expiry_date!),
      },
      create: {
        companyId,
        emailAddress,
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiry: new Date(tokens.expiry_date!),
      }
    })

    // Update company email to match the connected one just in case
    await prisma.company.update({
      where: { id: companyId },
      data: { email: emailAddress }
    })

    // Redirect back to settings page using the configured public base URL
    // Using req.url can fail in some Vercel/edge environments where the internal
    // request URL gets intercepted by the auth middleware before the session cookie is read.
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    return NextResponse.redirect(new URL('/app/settings/email-ai', baseUrl))
  } catch (error) {
    log.error({ err: String(error) }, 'Error in Google OAuth callback')
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
