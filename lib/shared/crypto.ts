import crypto from 'crypto'

const getMasterKey = (): Buffer => {
  const key = process.env.GMAIL_ENCRYPTION_KEY
  if (!key) {
    throw new Error('GMAIL_ENCRYPTION_KEY environment variable is required (32 bytes base64)')
  }
  const decoded = Buffer.from(key, 'base64')
  if (decoded.length !== 32) {
    throw new Error('GMAIL_ENCRYPTION_KEY must be 32 bytes (base64 encoded)')
  }
  return decoded
}

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns base64 encoded: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, masterKey, iv)
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  // Combine: iv (12) + ciphertext + authTag (16)
  const combined = Buffer.concat([iv, ciphertext, authTag])
  return combined.toString('base64')
}

/**
 * Decrypts a base64 encoded string encrypted with encrypt()
 */
export function decrypt(encrypted: string): string {
  const masterKey = getMasterKey()
  const data = Buffer.from(encrypted, 'base64')
  
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }
  
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGO, masterKey, iv)
  decipher.setAuthTag(authTag)
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ])
  
  return plaintext.toString('utf8')
}