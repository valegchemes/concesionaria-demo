/**
 * Rate Limiting con Upstash Redis
 * Implementa sliding window algorithm para protección contra DoS
 */

import { kv } from '@/lib/kv-client'
import { RateLimitError } from './errors'
import { createLogger } from './logger'

const log = createLogger('RateLimit')

export interface RateLimitConfig {
  /** Número máximo de requests permitidos */
  limit: number
  /** Ventana de tiempo en segundos */
  windowSeconds: number
  /** Prefijo para la key en Redis */
  prefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Implementación de sliding window rate limiting
 * Usa Redis sorted sets para tracking preciso
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
    // 1. Remover requests antiguos fuera de la ventana
    await kv.zremrangebyscore(key, 0, windowStart)

    // 2. Contar requests en la ventana actual
    const count = await kv.zcard(key)

    // 3. Verificar si excede el límite
    if (count >= limit) {
      // Obtener el timestamp del request más antiguo para calcular reset
      const oldest = await kv.zrange(key, 0, 0, { withScores: true })
      const resetTime = oldest.length > 0 
        ? (oldest[1] as number) + windowSeconds * 1000 
        : now + windowSeconds * 1000

      log.warn(
        { identifier, count, limit, windowSeconds },
        'Rate limit exceeded'
      )

      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.ceil(resetTime / 1000),
      }
    }

    // 4. Agregar el request actual
    await kv.zadd(key, { score: now, member: `${now}:${Math.random()}` })

    // 5. Establecer TTL para auto-cleanup
    await kv.expire(key, windowSeconds * 2)

    return {
      success: true,
      limit,
      remaining: limit - count - 1,
      reset: Math.ceil((now + windowSeconds * 1000) / 1000),
    }
  } catch (error) {
    // En caso de error de Redis, permitir el request (fail-open)
    // pero loguear el error para investigación
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
 * Prioriza: userId > IP > user-agent hash
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
