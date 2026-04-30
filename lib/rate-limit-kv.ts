import { kv } from '@/lib/kv-client'

// Timeout wrapper: si KV no responde en 2s, fail-open (no bloquear tráfico)
function withKVTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('KV_TIMEOUT')), ms)
    ),
  ])
}

// Configuración simple y pragmática
const MAX_REQUESTS = 100        // 100 requests por ventana
const WINDOW_SECONDS = 60       // Ventana de 1 minuto

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Rate limiting con Vercel KV (Redis serverless)
 * 
 * Funciona correctamente en serverless a diferencia de rate limit in-memory
 * que es local a cada función.
 * 
 * @param identifier - IP, userId, o combinación (ej: "ip:192.168.1.1" o "user:user_123")
 * @param path - Ruta del endpoint para rate limiting específico
 * @returns Resultado del rate limit con info de headers
 */
export async function checkRateLimit(
  identifier: string, 
  path?: string
): Promise<RateLimitResult> {
  const key = path 
    ? `ratelimit:${identifier}:${path}`
    : `ratelimit:${identifier}`
  
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS
  const reset = windowStart + WINDOW_SECONDS
  
  try {
    // Incrementar contador atómicamente (con timeout para evitar colgar en KV no disponible)
    const current = await withKVTimeout(kv.incr(key))
    
    // Si es la primera request en esta ventana, setear expiración (fire-and-forget)
    if (current === 1) {
      withKVTimeout(kv.expire(key, WINDOW_SECONDS)).catch(() => {})
    }
    
    return {
      success: current <= MAX_REQUESTS,
      limit: MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - current),
      reset: reset * 1000  // Convertir a ms para headers
    }
  } catch (error) {
    // Si KV falla, permitir request (fail-open para no bloquear tráfico legítimo)
    // Loggear error para monitoreo
    console.error('Rate limit KV error:', error)
    return {
      success: true,
      limit: MAX_REQUESTS,
      remaining: 1,
      reset: reset * 1000
    }
  }
}

/**
 * Rate limiting para endpoints críticos (más restrictivo)
 * Usar para: auth, pagos, operaciones destructivas
 */
export async function checkStrictRateLimit(
  identifier: string,
  path?: string
): Promise<RateLimitResult> {
  const key = path 
    ? `ratelimit:strict:${identifier}:${path}`
    : `ratelimit:strict:${identifier}`
  
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / 10) * 10  // Ventana de 10 segundos
  const reset = windowStart + 10
  
  const STRICT_MAX = 5  // 5 requests por 10 segundos
  
  try {
    const current = await withKVTimeout(kv.incr(key))
    
    if (current === 1) {
      withKVTimeout(kv.expire(key, 10)).catch(() => {})
    }
    
    return {
      success: current <= STRICT_MAX,
      limit: STRICT_MAX,
      remaining: Math.max(0, STRICT_MAX - current),
      reset: reset * 1000
    }
  } catch (error) {
    console.error('Strict rate limit KV error:', error)
    return {
      success: true,
      limit: STRICT_MAX,
      remaining: 1,
      reset: reset * 1000
    }
  }
}

/**
 * Helper para aplicar rate limit a una request
 * @returns null si pasa, Response si bloquea
 */
export async function applyRateLimit(
  request: Request,
  options?: { strict?: boolean; path?: string }
): Promise<Response | null> {
  // Extraer identifier (IP preferido, fallback a user-agent + fingerprint básico)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown'
  
  const identifier = ip
  const path = options?.path || new URL(request.url).pathname
  
  const result = options?.strict 
    ? await checkStrictRateLimit(identifier, path)
    : await checkRateLimit(identifier, path)
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString()
        }
      }
    )
  }
  
  return null
}
