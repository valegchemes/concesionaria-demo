/**
 * Rate Limiting In-Memory (Sin Redis)
 * Alternativa gratuita usando Map en memoria
 * 
 * NOTA: En producción con múltiples instancias, cada instancia
 * tendrá su propio contador. Para apps pequeñas esto es suficiente.
 */

import { RateLimitError } from './errors'
import { createLogger } from './logger'

const log = createLogger('RateLimit')

export interface RateLimitConfig {
  /** Número máximo de requests permitidos */
  limit: number
  /** Ventana de tiempo en segundos */
  windowSeconds: number
  /** Prefijo para la key */
  prefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

interface RateLimitEntry {
  requests: number[]
  resetAt: number
}

class InMemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Limpiar entradas expiradas cada 60 segundos
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup() {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      log.debug({ cleaned }, 'Cleaned up expired rate limit entries')
    }
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  size(): number {
    return this.store.size
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Singleton store
const store = new InMemoryRateLimitStore()

// ============================================================================
// RATE LIMITING LOGIC
// ============================================================================

/**
 * Implementación de sliding window rate limiting con memoria local
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, windowSeconds, prefix = 'ratelimit' } = config
  const key = `${prefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  try {
    // 1. Obtener entrada actual
    let entry = store.get(key)

    if (!entry) {
      // Primera request
      entry = {
        requests: [now],
        resetAt: now + windowSeconds * 1000,
      }
      store.set(key, entry)

      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.ceil(entry.resetAt / 1000),
      }
    }

    // 2. Filtrar requests dentro de la ventana
    entry.requests = entry.requests.filter((timestamp) => timestamp > windowStart)

    // 3. Verificar si excede el límite
    if (entry.requests.length >= limit) {
      const oldestRequest = entry.requests[0]
      const resetTime = oldestRequest + windowSeconds * 1000

      log.warn(
        { identifier, count: entry.requests.length, limit, windowSeconds },
        'Rate limit exceeded'
      )

      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.ceil(resetTime / 1000),
      }
    }

    // 4. Agregar request actual
    entry.requests.push(now)
    entry.resetAt = now + windowSeconds * 1000
    store.set(key, entry)

    return {
      success: true,
      limit,
      remaining: limit - entry.requests.length,
      reset: Math.ceil(entry.resetAt / 1000),
    }
  } catch (error) {
    // En caso de error, permitir el request (fail-open)
    log.error(
      { error: error instanceof Error ? error.message : String(error), identifier },
      'Rate limit check failed - allowing request'
    )

    return {
      success: true,
      limit,
      remaining: limit,
      reset: Math.ceil((now + windowSeconds * 1000) / 1000),
    }
  }
}

/**
 * Middleware helper para rate limiting en API routes
 * Lanza RateLimitError si se excede el límite
 */
export async function requireRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<void> {
  const result = await checkRateLimit(identifier, config)

  if (!result.success) {
    const retryAfter = result.reset - Math.floor(Date.now() / 1000)
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    )
  }
}

/**
 * Configuraciones predefinidas de rate limiting
 */
export const RATE_LIMITS = {
  /** APIs públicas: 100 req/min */
  PUBLIC_API: { limit: 100, windowSeconds: 60, prefix: 'rl:public' },
  
  /** APIs autenticadas: 300 req/min */
  AUTHENTICATED_API: { limit: 300, windowSeconds: 60, prefix: 'rl:auth' },
  
  /** Búsquedas: 20 req/min (más costosas) */
  SEARCH: { limit: 20, windowSeconds: 60, prefix: 'rl:search' },
  
  /** Login: 5 intentos/15min */
  LOGIN: { limit: 5, windowSeconds: 900, prefix: 'rl:login' },
  
  /** Registro: 3 intentos/hora */
  REGISTER: { limit: 3, windowSeconds: 3600, prefix: 'rl:register' },
  
  /** File upload: 10 archivos/hora */
  UPLOAD: { limit: 10, windowSeconds: 3600, prefix: 'rl:upload' },
  
  /** Webhooks: 1000 req/min (Stripe puede enviar muchos) */
  WEBHOOK: { limit: 1000, windowSeconds: 60, prefix: 'rl:webhook' },
} as const

/**
 * Helper para obtener identificador único del request
 */
export function getRequestIdentifier(request: Request): string {
  // 1. Usuario autenticado (mejor identificador)
  const userId = request.headers.get('x-user-id')
  if (userId) return `user:${userId}`

  // 2. IP address
  const ip = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // 3. Combinar IP + user-agent hash para mejor granularidad
  const userAgent = request.headers.get('user-agent') || ''
  const uaHash = simpleHash(userAgent)

  return `ip:${ip}:${uaHash}`
}

/**
 * Hash simple para user-agent (no criptográfico)
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}

/**
 * Obtener estadísticas del rate limiter
 */
export function getRateLimitStats() {
  return {
    totalKeys: store.size(),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Limpiar todas las entradas (útil para testing)
 */
export function clearRateLimits() {
  store.destroy()
  log.info({}, 'Rate limit store cleared')
}
