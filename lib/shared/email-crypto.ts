import { encrypt, decrypt } from './crypto'

/**
 * Encrypt a string field for storage in EmailInteraction.
 * Returns null for empty/null inputs.
 */
export function encryptEmailField(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.trim().length === 0) return null
  return encrypt(plaintext)
}

/**
 * Decrypt an encrypted field from EmailInteraction.
 * Returns empty string for null inputs (backward compat with old rows).
 */
export function decryptEmailField(encrypted: string | null | undefined): string {
  if (!encrypted || encrypted.trim().length === 0) return ''
  try {
    return decrypt(encrypted)
  } catch (e) {
    // If decryption fails, it might be a legacy plaintext row
    return encrypted
  }
}
