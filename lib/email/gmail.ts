import { google } from 'googleapis'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
]

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  // Construct redirect URL dynamically based on environment or explicitly defined
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/gmail/callback`
    : 'http://localhost:3000/api/email/gmail/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured in environment variables.')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function generateAuthUrl(companyId: string) {
  const oAuth2Client = getOAuth2Client()
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: companyId // We pass the companyId in state so we know who the user is on callback
  })
}

/**
 * Gets a fresh OAuth client for a specific company, refreshing the token if needed
 */
export async function getCompanyGmailClient(companyId: string) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { companyId }
  })

  if (!connection) return null

  const oAuth2Client = getOAuth2Client()
  oAuth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.tokenExpiry.getTime()
  })

  // Listen for automatic token refreshes by the google library
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updateData: any = {
        accessToken: tokens.access_token
      }
      if (tokens.refresh_token) {
        updateData.refreshToken = tokens.refresh_token
      }
      if (tokens.expiry_date) {
        updateData.tokenExpiry = new Date(tokens.expiry_date)
      }
      await prisma.gmailConnection.update({
        where: { companyId },
        data: updateData
      })
    }
  })

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
  return { gmail, oAuth2Client, emailAddress: connection.emailAddress }
}

/**
 * Lists unread emails in the inbox
 */
export async function listUnreadEmails(companyId: string) {
  const client = await getCompanyGmailClient(companyId)
  if (!client) return []

  const { gmail } = client
  
  // We only care about unread messages in the INBOX
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox category:primary',
    maxResults: 10
  })

  const messages = res.data.messages || []
  const parsedEmails = []

  for (const msg of messages) {
    if (!msg.id) continue
    
    const details = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full'
    })

    const payload = details.data.payload
    const headers = payload?.headers || []
    
    const subject = headers.find(h => h.name === 'Subject')?.value || 'Sin Asunto'
    let from = headers.find(h => h.name === 'From')?.value || ''
    
    // Extract actual email address if format is "Name <email@domain.com>"
    const emailMatch = from.match(/<(.+)>/)
    if (emailMatch) {
      from = emailMatch[1]
    }

    let body = ''
    
    // Simple parser for plain text / HTML (fallback)
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf8')
    } else if (payload?.parts) {
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf8')
      }
    }

    parsedEmails.push({
      id: msg.id,
      from,
      subject,
      body,
      threadId: details.data.threadId
    })
  }

  return parsedEmails
}

/**
 * Sends an email using Nodemailer wrapped with the OAuth2 client
 */
export async function sendReply(
  companyId: string, 
  to: string, 
  subject: string, 
  htmlBody: string, 
  inReplyTo?: string, 
  threadId?: string
) {
  const client = await getCompanyGmailClient(companyId)
  if (!client) throw new Error('Gmail no está conectado.')

  const { oAuth2Client, emailAddress } = client
  const tokens = await oAuth2Client.getAccessToken()

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: emailAddress,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: oAuth2Client.credentials.refresh_token as string,
      accessToken: tokens.token as string
    }
  })

  // Format HTML body to plain text roughly, for the fallback
  const textBody = htmlBody.replace(/<[^>]*>?/gm, '')

  const mailOptions: any = {
    from: emailAddress,
    to,
    subject,
    text: textBody,
    html: htmlBody
  }

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo
  }

  // Not strictly using Gmail API for sending here, using Nodemailer which is much easier to format
  const result = await transporter.sendMail(mailOptions)
  return result
}

/**
 * Marks a message as read in Gmail
 */
export async function markAsRead(companyId: string, messageId: string) {
  const client = await getCompanyGmailClient(companyId)
  if (!client) return

  const { gmail } = client
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD']
    }
  })
}
