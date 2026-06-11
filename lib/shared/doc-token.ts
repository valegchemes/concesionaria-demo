import { SignJWT, jwtVerify } from 'jose'

const getKey = () => {
  const secret = process.env.DOC_ACCESS_SECRET
  if (!secret) {
    throw new Error('DOC_ACCESS_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
}

export async function generateDocAccessToken(docId: string, ttlMinutes = 15): Promise<string> {
  return new SignJWT({ docId, type: 'doc_download' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(getKey())
}

export async function verifyDocAccessToken(token: string): Promise<{ docId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getKey())
    if (payload.type !== 'doc_download') return null
    return { docId: payload.docId as string }
  } catch {
    return null
  }
}