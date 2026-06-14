/**
 * Enterprise Vercel Blob Utilities
 * - Validación de archivos (tamaño, tipo MIME)
 * - Subida atómica: limpieza automática si falla DB
 * - Manejo de errores robusto
 * - Logging detallado
 */

import { put, del } from '@vercel/blob'
import { createLogger } from '@/lib/shared/logger'
import { ValidationError, InternalServerError } from '@/lib/shared/errors'

const log = createLogger('BlobServer')

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

export const BLOB_CONFIG = {
  // Tamaño máximo: 5MB para imágenes
  maxFileSize: 5 * 1024 * 1024,
  
  // Tipos MIME permitidos
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/bmp',
    'image/tiff',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  
  // Extensiones permitidas (para validación adicional)
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', 
    '.avif', '.heic', '.heif', '.bmp', '.tiff', '.tif',
    '.pdf', '.doc', '.docx'
  ] as const,
  
  // Prefijos de path para organización
  pathPrefixes: {
    units: 'units',
    users: 'users',
    companies: 'companies',
    temp: 'temp',
  } as const,
} as const

type AllowedMimeType = typeof BLOB_CONFIG.allowedMimeTypes[number]
type AllowedExtension = typeof BLOB_CONFIG.allowedExtensions[number]
type PathPrefix = typeof BLOB_CONFIG.pathPrefixes[keyof typeof BLOB_CONFIG.pathPrefixes]

// ============================================================================
// TIPOS ESTRUCTURADOS
// ============================================================================

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export interface UploadResult {
  url: string
  pathname: string
  contentType: string
  contentDisposition: string
}

export interface UploadOptions {
  companyId: string
  userId: string
  resourceType: PathPrefix
  resourceId?: string
  filename?: string
  addRandomSuffix?: boolean
  access?: 'public' | 'private'
}

// ============================================================================
// VALIDACIÓN DE ARCHIVOS
// ============================================================================

/**
 * Extrae la extensión de un filename
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(lastDot).toLowerCase() : ''
}

/**
 * Valida el tipo MIME del archivo
 */
function validateMimeType(contentType: string): FileValidationResult {
  const isAllowed = BLOB_CONFIG.allowedMimeTypes.includes(contentType as AllowedMimeType)
  
  if (!isAllowed) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${contentType}. Tipos permitidos: ${BLOB_CONFIG.allowedMimeTypes.join(', ')}`,
    }
  }
  
  return { valid: true }
}

/**
 * Valida la extensión del archivo
 */
function validateExtension(filename: string): FileValidationResult {
  const ext = getExtension(filename)
  
  if (!ext) {
    return { valid: false, error: 'El archivo debe tener una extensión válida' }
  }
  
  const isAllowed = BLOB_CONFIG.allowedExtensions.includes(ext as AllowedExtension)
  
  if (!isAllowed) {
    return {
      valid: false,
      error: `Extensión no permitida: ${ext}. Extensiones permitidas: ${BLOB_CONFIG.allowedExtensions.join(', ')}`,
    }
  }
  
  return { valid: true }
}

/**
 * Valida el tamaño del archivo
 */
function validateFileSize(size: number): FileValidationResult {
  if (size > BLOB_CONFIG.maxFileSize) {
    const maxSizeMB = BLOB_CONFIG.maxFileSize / (1024 * 1024)
    return {
      valid: false,
      error: `Archivo demasiado grande: ${(size / (1024 * 1024)).toFixed(2)}MB. Máximo permitido: ${maxSizeMB}MB`,
    }
  }
  
  return { valid: true }
}

/**
 * Validación completa de archivo antes de subida
 */
export function validateFile(
  file: File | { name: string; type: string; size: number }
): FileValidationResult {
  // Validar extensión
  const extValidation = validateExtension(file.name)
  if (!extValidation.valid) return extValidation
  
  // Validar tipo MIME
  const mimeValidation = validateMimeType(file.type)
  if (!mimeValidation.valid) return mimeValidation
  
  // Validar tamaño
  const sizeValidation = validateFileSize(file.size)
  if (!sizeValidation.valid) return sizeValidation
  
  return { valid: true }
}

// ============================================================================
// GENERACIÓN DE PATHS
// ============================================================================

/**
 * Genera un pathname seguro y estructurado para el blob
 * Formato: {resourceType}/{companyId}/{resourceId}/{filename}
 */
function generatePathname(options: UploadOptions, originalFilename: string): string {
  const { companyId, resourceType, resourceId } = options
  
  // Sanitizar filename
  const sanitized = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Reemplazar caracteres especiales
    .replace(/_{2,}/g, '_') // Evitar múltiples underscores
    .toLowerCase()
  
  // Construir path
  const parts = [resourceType, companyId]
  
  if (resourceId) {
    parts.push(resourceId)
  }
  
  parts.push(sanitized)
  
  return parts.join('/')
}

// ============================================================================
// SUBIDA ATÓMICA
// ============================================================================

/**
 * Subida atómica de archivo a Vercel Blob
 * 
 * Si la operación de DB falla después de la subida, el archivo se elimina
 * automáticamente para mantener consistencia.
 * 
 * @example
 * const result = await uploadFileAtomic(
 *   file,
 *   {
 *     companyId: 'comp_123',
 *     userId: 'user_456',
 *     resourceType: 'units',
 *     resourceId: 'unit_789'
 *   },
 *   async (blobUrl) => {
 *     // Guardar URL en DB
 *     await db.unitPhoto.create({ data: { url: blobUrl, unitId: 'unit_789' } })
 *   }
 * )
 */
export async function uploadFileAtomic(
  file: File | Blob,
  filename: string,
  options: UploadOptions,
  dbOperation: (blobUrl: string) => Promise<void>
): Promise<UploadResult> {
  const startTime = Date.now()
  
  log.info(
    { 
      filename, 
      companyId: options.companyId, 
      resourceType: options.resourceType,
      resourceId: options.resourceId 
    },
    'Iniciando subida atómica'
  )
  
  // 1. Validar archivo
  if (file instanceof File) {
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new ValidationError(validation.error!)
    }
  }
  
  // 2. Generar pathname
  const pathname = generatePathname(options, filename)
  
  let blobUrl: string | null = null
  
  try {
    // 3. Subir archivo a Vercel Blob
    const blob = await put(pathname, file, {
      access: options.access ?? 'public',
      addRandomSuffix: options.addRandomSuffix ?? true,
      contentType: file.type || 'application/octet-stream',
    })
    
    blobUrl = blob.url
    
    log.info(
      { 
        pathname, 
        url: blobUrl,
        duration: Date.now() - startTime 
      },
      'Archivo subido a Blob, ejecutando operación DB'
    )
    
    // 4. Ejecutar operación de base de datos
    await dbOperation(blobUrl)
    
    log.info(
      { 
        pathname, 
        url: blobUrl,
        duration: Date.now() - startTime 
      },
      'Operación DB completada - subida atómica exitosa'
    )
    
    return {
      url: blobUrl,
      pathname,
      contentType: blob.contentType ?? file.type ?? 'application/octet-stream',
      contentDisposition: blob.contentDisposition ?? 'inline',
    }
    
  } catch (error) {
    log.error(
      { 
        error: error instanceof Error ? error.message : String(error),
        pathname,
        url: blobUrl,
        duration: Date.now() - startTime 
      },
      'Error en subida atómica'
    )
    
    // 5. LIMPIEZA: Si el archivo se subió pero la DB falló, eliminarlo
    if (blobUrl) {
      try {
        await deleteFile(blobUrl)
        log.info({ url: blobUrl }, 'Archivo eliminado por rollback atómico')
      } catch (cleanupError) {
        log.error(
          { 
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            url: blobUrl 
          },
          'Error en limpieza de archivo (rollback)'
        )
      }
    }
    
    throw error instanceof Error ? error : new InternalServerError(String(error))
  }
}

// ============================================================================
// ELIMINACIÓN
// ============================================================================

/**
 * Elimina un archivo de Vercel Blob por su URL
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url)
    log.info({ url }, 'Archivo eliminado de Blob')
  } catch (error) {
    log.error(
      { 
        error: error instanceof Error ? error.message : String(error),
        url 
      },
      'Error eliminando archivo de Blob'
    )
    throw error
  }
}

/**
 * Elimina múltiples archivos de Vercel Blob con reintentos
 */
export async function deleteFiles(
  urls: string[],
  options: { retries?: number; throwOnError?: boolean } = {}
): Promise<{ deleted: string[]; failed: string[] }> {
  const { retries = 2, throwOnError = false } = options
  const failedUrls: string[] = []
  let urlsToProcess = [...urls]

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (urlsToProcess.length === 0) break

    if (attempt > 0) {
      log.info({ attempt, remaining: urlsToProcess.length }, 'Retry deleting blob files')
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }

    const results = await Promise.allSettled(urlsToProcess.map(url => deleteFile(url)))

    urlsToProcess = urlsToProcess
      .map((url, index) => ({ url, status: results[index].status }))
      .filter(item => item.status === 'rejected')
      .map(item => item.url)
  }

  failedUrls.push(...urlsToProcess)
  const deleted = urls.filter(url => !failedUrls.includes(url))

  if (failedUrls.length > 0) {
    log.error(
      { failedUrls, deletedCount: deleted.length, totalCount: urls.length },
      'Some blob files could not be deleted after all retries'
    )
    if (throwOnError) {
      throw new Error(`Failed to delete ${failedUrls.length} blob files`)
    }
  } else {
    log.info({ count: deleted.length }, 'All blob files deleted successfully')
  }

  return { deleted, failed: failedUrls }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene información de un blob por su URL
 */
export function getBlobInfo(url: string): {
  pathname: string
  filename: string
  isPublic: boolean
} {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.replace(/^\//, '')
    const parts = pathname.split('/')
    const filename = parts[parts.length - 1] || 'unknown'
    
    return {
      pathname,
      filename,
      isPublic: urlObj.hostname.includes('public.blob.vercel-storage.com'),
    }
  } catch {
    return { pathname: '', filename: 'unknown', isPublic: false }
  }
}

/**
 * Verifica si una URL es de Vercel Blob
 */
export function isVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com') || url.includes('vercel-storage.com')
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BLOB_CONFIG as blobConfig }
export default {
  uploadFileAtomic,
  deleteFile,
  deleteFiles,
  validateFile,
  getBlobInfo,
  isVercelBlobUrl,
  BLOB_CONFIG,
}
