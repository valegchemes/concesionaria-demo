export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/email/gmail'
import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const companyId = searchParams.get('state') // We passed companyId in state

    if (!code || !companyId) {
      return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 })
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

    // Save or update in database
    await prisma.gmailConnection.upsert({
      where: { companyId },
      update: {
        emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date)
      },
      create: {
        companyId,
        emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date)
      }
    })

    // Update company email to match the connected one just in case
    await prisma.company.update({
      where: { id: companyId },
      data: { email: emailAddress }
    })

    // Redirect back to settings page
    return NextResponse.redirect(new URL('/app/settings/email-ai', req.url))
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
