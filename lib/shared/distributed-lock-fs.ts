/**
 * Distributed Lock con Filesystem (Sin Redis)
 * Alternativa gratuita usando archivos temporales
 * 
 * NOTA: Funciona bien en single-instance o con filesystem compartido (NFS).
 * Para múltiples instancias sin filesystem compartido, usar Redis.
 */

import fs from 'fs/promises'
import path from 'path'
import { createLogger } from './logger'

const log = createLogger('DistributedLock')

export interface LockOptions {
  /** Tiempo máximo de lock en segundos (default: 300s = 5min) */
  ttlSeconds?: number
  /** Número de reintentos si el lock está ocupado (default: 0) */
  retries?: number
  /** Delay entre reintentos en ms (default: 1000ms) */
  retryDelayMs?: number
}

export class LockAcquisitionError extends Error {
  constructor(lockKey: string) {
    super(`Failed to acquire lock: ${lockKey}`)
    this.name = 'LockAcquisitionError'
  }
}

// Directorio para locks (en /tmp o similar)
const LOCK_DIR = path.join(process.cwd(), '.locks')

/**
 * Inicializar directorio de locks
 */
async function ensureLockDir() {
  try {
    await fs.mkdir(LOCK_DIR, { recursive: true })
  } catch (error) {
    // Ignorar si ya existe
  }
}

/**
 * Obtener path del archivo de lock
 */
function getLockPath(lockKey: string): string {
  // Sanitizar lockKey para nombre de archivo seguro
  const safeName = lockKey.replace(/[^a-zA-Z0-9-_]/g, '_')
  return path.join(LOCK_DIR, `${safeName}.lock`)
}

/**
 * Verificar si un lock está expirado
 */
async function isLockExpired(lockPath: string, ttlSeconds: number): Promise<boolean> {
  try {
    const stats = await fs.stat(lockPath)
    const ageMs = Date.now() - stats.mtimeMs
    return ageMs > ttlSeconds * 1000
  } catch {
    // Si no existe el archivo, está "expirado"
    return true
  }
}

/**
 * Adquiere un lock distribuido
 * @returns Token único del lock (para release)
 */
export async function acquireLock(
  lockKey: string,
  options: LockOptions = {}
): Promise<string> {
  const {
    ttlSeconds = 300,
    retries = 0,
    retryDelayMs = 1000,
  } = options

  await ensureLockDir()

  const lockToken = `${Date.now()}:${Math.random()}`
  const lockPath = getLockPath(lockKey)

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Verificar si existe un lock expirado
      const expired = await isLockExpired(lockPath, ttlSeconds)

      if (expired) {
        // Intentar eliminar lock expirado
        try {
          await fs.unlink(lockPath)
        } catch {
          // Ignorar si no existe
        }
      }

      // Intentar crear archivo de lock (exclusivo)
      // Nota: 'wx' flag = write + exclusive (falla si existe)
      await fs.writeFile(lockPath, lockToken, { flag: 'wx' })

      log.debug({ lockKey, lockToken, ttlSeconds }, 'Lock acquired')
      return lockToken
    } catch (error: any) {
      // EEXIST = archivo ya existe (lock ocupado)
      if (error.code === 'EEXIST') {
        // Verificar si está expirado
        const expired = await isLockExpired(lockPath, ttlSeconds)

        if (expired) {
          // Lock expirado, intentar eliminarlo y reintentar
          try {
            await fs.unlink(lockPath)
            continue
          } catch {
            // Otro proceso lo eliminó primero
          }
        }

        if (attempt < retries) {
          log.debug(
            { lockKey, attempt, retries },
            'Lock busy, retrying...'
          )
          await sleep(retryDelayMs)
          continue
        }
      } else {
        // Error inesperado
        log.error(
          { error: error.message, lockKey },
          'Error acquiring lock'
        )
        throw error
      }
    }
  }

  throw new LockAcquisitionError(lockKey)
}

/**
 * Libera un lock distribuido
 * Solo libera si el token coincide
 */
export async function releaseLock(
  lockKey: string,
  lockToken: string
): Promise<void> {
  const lockPath = getLockPath(lockKey)

  try {
    // Leer token actual
    const currentToken = await fs.readFile(lockPath, 'utf-8')

    if (currentToken === lockToken) {
      await fs.unlink(lockPath)
      log.debug({ lockKey, lockToken }, 'Lock released')
    } else {
      log.warn(
        { lockKey, expectedToken: lockToken, actualToken: currentToken },
        'Lock token mismatch - not releasing'
      )
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Lock ya no existe (probablemente expiró)
      log.debug({ lockKey }, 'Lock already released or expired')
    } else {
      log.error(
        { error: error.message, lockKey },
        'Error releasing lock'
      )
    }
  }
}

/**
 * Ejecuta una función con lock automático
 * Garantiza que el lock se libera incluso si la función falla
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lockToken = await acquireLock(lockKey, options)

  try {
    return await fn()
  } finally {
    await releaseLock(lockKey, lockToken)
  }
}

/**
 * Verifica si un lock está activo
 */
export async function isLocked(lockKey: string): Promise<boolean> {
  const lockPath = getLockPath(lockKey)

  try {
    await fs.access(lockPath)
    return true
  } catch {
    return false
  }
}

/**
 * Fuerza la liberación de un lock (usar solo en emergencias)
 */
export async function forceReleaseLock(lockKey: string): Promise<void> {
  const lockPath = getLockPath(lockKey)

  try {
    await fs.unlink(lockPath)
    log.warn({ lockKey }, 'Lock forcefully released')
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      log.error({ error: error.message, lockKey }, 'Error force-releasing lock')
    }
  }
}

/**
 * Limpiar locks expirados (mantenimiento)
 */
export async function cleanupExpiredLocks(ttlSeconds: number = 300): Promise<number> {
  await ensureLockDir()

  try {
    const files = await fs.readdir(LOCK_DIR)
    let cleaned = 0

    for (const file of files) {
      if (!file.endsWith('.lock')) continue

      const lockPath = path.join(LOCK_DIR, file)
      const expired = await isLockExpired(lockPath, ttlSeconds)

      if (expired) {
        try {
          await fs.unlink(lockPath)
          cleaned++
        } catch {
          // Ignorar errores (otro proceso lo eliminó)
        }
      }
    }

    if (cleaned > 0) {
      log.info({ cleaned }, 'Cleaned up expired locks')
    }

    return cleaned
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error cleaning up locks')
    return 0
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Cleanup periódico cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredLocks().catch(err => {
      log.error({ error: err.message }, 'Error in periodic lock cleanup')
    })
  }, 5 * 60 * 1000)
}
