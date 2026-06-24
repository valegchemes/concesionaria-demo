import { encrypt, decrypt } from './crypto'
import { createLogger } from './logger'

const log = createLogger('EmailCrypto')

/**
 * Prefijo que marca un valor como cifrado con esta capa. Sirve para distinguir
 * un ciphertext legítimo de un plaintext legacy (filas anteriores al cifrado).
 */
const ENCRYPTED_PREFIX = 'enc::'

/**
 * Encrypt a string field for storage in EmailInteraction.
 * Returns null for empty/null inputs. Marca el resultado con un prefijo
 * versionado para que el descifrado distinga ciphertext de legacy plaintext.
 */
export function encryptEmailField(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.trim().length === 0) return null
  return `${ENCRYPTED_PREFIX}${encrypt(plaintext)}`
}

// Heurística simple para reconocer un plaintext "legacy" (email/dirección) que
// nunca fue cifrado. Se usa solo en el fallback de descifrado.
const LOOKS_LIKE_PLAINTEXT = /^[^\s]+$/ // sin espacios ni saltos: emails, tokens cortos

/**
 * Decrypt an encrypted field from EmailInteraction.
 * Returns empty string for null inputs (backward compat with old rows).
 *
 * Comportamiento:
 * - Si el valor tiene el prefijo `enc::`, se descifra (forma canónica).
 * - Si no tiene prefijo pero descifra OK (filas viejas pre-prefijo), se devuelve.
 * - Si no descifra y parece plaintext legible (legacy), se devuelve tal cual y
 *   se loguea en warn para detectar rotaciones de clave mal aplicadas.
 * - Si no descifra y NO parece plaintext (ciphertext corrupto/clave rotada), se
 *   devuelve '' y se loguea en error para investigar.
 */
export function decryptEmailField(encrypted: string | null | undefined): string {
  if (!encrypted || encrypted.trim().length === 0) return ''

  // Forma canónica con prefijo.
  if (encrypted.startsWith(ENCRYPTED_PREFIX)) {
    const payload = encrypted.slice(ENCRYPTED_PREFIX.length)
    try {
      return decrypt(payload)
    } catch (e) {
      log.error(
        { err: e instanceof Error ? e.message : String(e) },
        'decryptEmailField: valor con prefijo enc:: pero descifrado falló (¿clave rotada sin re-cifrar?)'
      )
      return ''
    }
  }

  // Legacy sin prefijo: intentar descifrar (filas escritas antes del prefijo).
  try {
    return decrypt(encrypted)
  } catch {
    // No es ciphertext válido. Podría ser plaintext legacy o basura.
    if (LOOKS_LIKE_PLAINTEXT.test(encrypted) && encrypted.length <= 320) {
      log.warn(
        { len: encrypted.length },
        'decryptEmailField: fallback a plaintext legacy detectado. Si rotaste la clave, re-cifrá estas filas.'
      )
      return encrypted
    }
    log.error(
      { len: encrypted.length },
      'decryptEmailField: valor no descifrable y no parece plaintext legible. Devolviendo vacío.'
    )
    return ''
  }
}
