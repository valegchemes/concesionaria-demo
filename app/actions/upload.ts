'use server'

import { put } from '@vercel/blob'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'
import crypto from 'crypto'

const log = createLogger('UploadAction')

// ============================================================================
// MIME type whitelist — solo imágenes seguras para el CRM
// ============================================================================
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Detecta el MIME type real del archivo analizando sus magic bytes.
 * NO confía en file.type (puede ser falsificado por el cliente).
 *
 * Magic bytes:
 *   JPEG: FF D8 FF
 *   PNG:  89 50 4E 47 0D 0A 1A 0A
 *   WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
 */
async function detectMimeType(file: File): Promise<string | null> {
  // Leer los primeros 12 bytes para cubrir todos los magic bytes necesarios
  const slice = file.slice(0, 12)
  const buffer = new Uint8Array(await slice.arrayBuffer())

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
    buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
    buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WebP: RIFF????WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

/** Mapea MIME type a extensión segura */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  return map[mime] ?? 'bin'
}

export async function uploadImageServerAction(formData: FormData): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const file = formData.get('file') as File
  if (!file) {
    throw new Error('No file provided')
  }

  // Validar tamaño (5 MB máximo)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)')
  }

  // Validar MIME type REAL por magic bytes — no confiar en file.type
  const realMime = await detectMimeType(file)
  if (!realMime || !(ALLOWED_MIME_TYPES as readonly string[]).includes(realMime)) {
    log.warn({ filename: file.name, reportedType: file.type, detectedType: realMime }, 'Upload rechazado: tipo de archivo no permitido')
    throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG o WebP.')
  }

  // Generar nombre único para evitar colisiones y sobrescrituras
  const ext = mimeToExt(realMime)
  const uniqueFilename = `${crypto.randomUUID()}.${ext}`

  try {
    // addRandomSuffix: false porque ya usamos UUID como nombre
    const blob = await put(uniqueFilename, file, {
      access: 'public',
      addRandomSuffix: false,
      contentType: realMime, // Usar el MIME verificado, no el declarado por el cliente
    })

    log.info({ filename: uniqueFilename, size: file.size, mime: realMime }, 'Imagen subida exitosamente')
    return blob.url
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Vercel Blob put error')
    throw new Error('Failed to upload image to storage')
  }
}

