/**
 * Distributed Lock con Redis
 * Previene ejecución concurrente de cron jobs
 */

import { kv } from '@/lib/kv-client'
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

  const lockToken = `${Date.now()}:${Math.random()}`
  const key = `lock:${lockKey}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // SET NX EX: solo establece si no existe, con TTL
      const acquired = await kv.set(key, lockToken, {
        nx: true,
        ex: ttlSeconds,
      })

      if (acquired) {
        log.debug({ lockKey, lockToken, ttlSeconds }, 'Lock acquired')
        return lockToken
      }

      // Lock ocupado, verificar si está expirado
      const currentHolder = await kv.get(key)
      if (!currentHolder) {
        // Race condition: lock se liberó entre SET y GET, reintentar
        continue
      }

      if (attempt < retries) {
        log.debug(
          { lockKey, attempt, retries },
          'Lock busy, retrying...'
        )
        await sleep(retryDelayMs)
      }
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error), lockKey },
        'Error acquiring lock'
      )
      throw error
    }
  }

  throw new LockAcquisitionError(lockKey)
}

/**
 * Libera un lock distribuido
 * Solo libera si el token coincide (evita liberar locks de otros procesos)
 */
export async function releaseLock(
  lockKey: string,
  lockToken: string
): Promise<void> {
  const key = `lock:${lockKey}`

  try {
    // Lua script para atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    // Nota: @vercel/kv no soporta EVAL directamente
    // Alternativa: verificar y eliminar (no atómico pero suficiente)
    const currentToken = await kv.get(key)
    if (currentToken === lockToken) {
      await kv.del(key)
      log.debug({ lockKey, lockToken }, 'Lock released')
    } else {
      log.warn(
        { lockKey, expectedToken: lockToken, actualToken: currentToken },
        'Lock token mismatch - not releasing'
      )
    }
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error), lockKey },
      'Error releasing lock'
    )
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
  const key = `lock:${lockKey}`
  const value = await kv.get(key)
  return value !== null
}

/**
 * Fuerza la liberación de un lock (usar solo en emergencias)
 */
export async function forceReleaseLock(lockKey: string): Promise<void> {
  const key = `lock:${lockKey}`
  await kv.del(key)
  log.warn({ lockKey }, 'Lock forcefully released')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
