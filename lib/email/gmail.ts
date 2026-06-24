import crypto from 'crypto'
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

/**
 * Genera un state firmado con HMAC para prevenir OAuth CSRF attacks.
 * El state contiene: companyId + timestamp + HMAC.
 *
 * El timestamp se valida por frescura en `verifyOAuthState` (anti-replay) y la
 * clave del HMAC es el secret completo (antes se truncaba a 16 chars, lo que
 * reducía innecesariamente la entropía de la clave).
 */
function signOAuthState(companyId: string): string {
  const secret = process.env.GMAIL_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || ''
  if (!secret) {
    throw new Error('Se requiere GMAIL_ENCRYPTION_KEY o NEXTAUTH_SECRET para firmar OAuth state')
  }
  const timestamp = Date.now().toString(36)
  const payload = `${companyId}:${timestamp}`
  // Usar el secret completo como clave HMAC (64 bits de output bastan para
  // anti-falsificación por red, pero la clave no debe truncarse).
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16)
  return `${payload}:${hmac}`
}

// Ventana máxima de validez del state (anti-replay). Un state robado (p.ej. de
// un log de referrer) ya no sirve para vincular una cuenta Gmail atacante.
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutos

/**
 * Verifica y extrae el companyId de un state firmado.
 * Retorna null si el state es inválido, manipulado o está expirado.
 */
export function verifyOAuthState(state: string): string | null {
  try {
    const parts = state.split(':')
    if (parts.length < 3) return null
    const hmac = parts.pop()!
    const payload = parts.join(':')
    const secret = process.env.GMAIL_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || ''
    if (!secret) return null
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16)

    // Timing-safe comparison
    if (hmac.length !== expected.length) return null
    let result = 0
    for (let i = 0; i < hmac.length; i++) {
      result |= hmac.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    if (result !== 0) return null

    // Validar frescura del timestamp (anti-replay). parts[1] = timestamp en base36.
    const ts = parseInt(parts[1], 36)
    if (!Number.isFinite(ts) || Date.now() - ts > OAUTH_STATE_MAX_AGE_MS) {
      log.warn({}, 'OAuth state rechazado por expirado (anti-replay)')
      return null
    }

    // Extraer companyId (primer parte antes del primer ':')
    return parts[0]
  } catch {
    return null
  }
}

export function generateAuthUrl(companyId: string) {
  const oAuth2Client = getOAuth2Client()
  const signedState = signOAuthState(companyId)
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: signedState // State firmado con HMAC para prevenir CSRF en OAuth callback
  })
}

/**
 * Gets a fresh OAuth client for a specific company, refreshing the token if needed.
 * Tokens are read from encrypted fields only (accessTokenEnc / refreshTokenEnc).
 */
export async function getCompanyGmailClient(companyId: string) {
  const connection = await prisma.gmailConnection.findUnique({
    where: { companyId }
  })

  if (!connection) return null

  let accessToken: string | undefined
  let refreshToken: string | undefined
  let expiryDate: number | undefined

  if (connection.accessTokenEnc && connection.refreshTokenEnc) {
    try {
      accessToken = decrypt(connection.accessTokenEnc)
      refreshToken = decrypt(connection.refreshTokenEnc)
      expiryDate = connection.tokenExpiry?.getTime()
    } catch (e) {
      log.error({ err: String(e) }, '[Gmail] Failed to decrypt tokens')
      return null
    }
  }

  if (!accessToken || !refreshToken) {
    log.error({ companyId }, '[Gmail] No valid encrypted tokens found for company')
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
