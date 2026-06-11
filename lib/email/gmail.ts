import { google } from 'googleapis'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/shared/crypto'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('GmailClient')

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email'
]

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  // Use NEXTAUTH_URL which is already configured in production, fallback to localhost for dev
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/email/gmail/callback`

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
 * Supports dual read: new encrypted fields (preferred) + legacy plaintext fields (fallback for migration)
 */
export async function getCompanyGmailClient(companyId: string) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { companyId }
  })

  if (!connection) return null

  let accessToken: string | undefined
  let refreshToken: string | undefined
  let expiryDate: number | undefined

  // 1. Try NEW encrypted fields first
  if (connection.accessTokenEnc && connection.refreshTokenEnc) {
    try {
      accessToken = decrypt(connection.accessTokenEnc)
      refreshToken = decrypt(connection.refreshTokenEnc)
      expiryDate = connection.tokenExpiry?.getTime()
    } catch (e) {
      log.error({ err: String(e) }, '[Gmail] Failed to decrypt tokens, falling back to legacy')
      accessToken = undefined
      refreshToken = undefined
    }
  }

  // 2. FALLBACK: Legacy plaintext fields (for migration period)
  if (!accessToken && connection.accessToken && connection.refreshToken) {
    log.warn({ companyId }, '[Gmail] Using LEGACY plaintext tokens - run migration script')
    accessToken = connection.accessToken
    refreshToken = connection.refreshToken
    expiryDate = connection.tokenExpiry?.getTime()
  }

  if (!accessToken || !refreshToken) {
    log.error({ companyId }, '[Gmail] No valid tokens found for company')
    return null
  }

  const oAuth2Client = getOAuth2Client()
  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate
  })

  // Listen for automatic token refreshes by the google library
  // Save to NEW encrypted fields
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const { encrypt } = await import('@/lib/shared/crypto')
      const updateData: any = {
        accessTokenEnc: encrypt(tokens.access_token),
      }
      if (tokens.refresh_token) {
        updateData.refreshTokenEnc = encrypt(tokens.refresh_token)
      }
      if (tokens.expiry_date) {
        updateData.tokenExpiry = new Date(tokens.expiry_date)
      }
      // Clear legacy fields after successful encryption
      updateData.accessToken = null
      updateData.refreshToken = null
      
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

    const messageIdHeader = headers.find(h => h.name?.toLowerCase() === 'message-id')?.value || ''

    parsedEmails.push({
      id: msg.id,
      from,
      subject,
      body,
      threadId: details.data.threadId,
      messageIdHeader
    })
  }

  return parsedEmails
}

/**
 * Sends an email using Gmail API instead of SMTP to avoid credential and port restrictions.
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

  const { gmail, emailAddress } = client

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  
  const headers = [
    `From: ${emailAddress}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const message = [...headers, '', htmlBody].join('\r\n');
  
  // Base64Url encode the message safely
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId || undefined
    }
  });
  return result;
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
