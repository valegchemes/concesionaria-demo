import crypto from 'crypto'

/**
 * Anonymize an IP address using HMAC-SHA256 with a server-side secret.
 * Produces a deterministic hash that:
 * - Cannot be reversed to obtain the original IP
 * - Is consistent for the same IP (useful for counting unique visitors)
 * - Satisfies GDPR "anonymization" requirements when the secret is kept secure
 */
export function hashIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET || process.env.NEXTAUTH_SECRET || ''
  if (!secret) {
    throw new Error('IP_HASH_SECRET or NEXTAUTH_SECRET is required for IP hashing')
  }
  return crypto
    .createHmac('sha256', secret)
    .update(ip.trim())
    .digest('hex')
    .slice(0, 32) // 64 chars is overkill; 32 is enough for uniqueness
}
