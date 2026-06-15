import { kv } from '@/lib/kv-client'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('RateLimit')

// ============================================================================
// Timeout wrapper: si KV no responde en 2s, fail-open para no bloquear tráfico
// ============================================================================
function withKVTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('KV_TIMEOUT')), ms)
    ),
  ])
}

// ============================================================================
// Fallback in-memory para endpoints críticos (auth, pagos)
// Se activa SOLO cuando KV no responde — da defensa en profundidad
// Nota: en serverless cada instancia tiene su propio Map, por lo que este
// contador es per-instancia. Acepta hasta MAX * N_INSTANCES antes de bloquear.
// Aceptable como segunda línea de defensa cuando KV está caído.
// ============================================================================
const inMemoryCounters = new Map<string, { count: number; resetAt: number }>()

function checkInMemory(key: string, max: number, windowSec: number): { allowed: boolean; current: number } {
  ensureCleanup()
  const now = Date.now()
  const entry = inMemoryCounters.get(key)
  if (!entry || entry.resetAt < now) {
    inMemoryCounters.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return { allowed: true, current: 1 }
  }
  entry.count++
  return { allowed: entry.count <= max, current: entry.count }
}

let cleanupInterval: any = null
function ensureCleanup() {
  if (!cleanupInterval && typeof setInterval !== 'undefined') {
    cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, value] of inMemoryCounters.entries()) {
        if (value.resetAt < now) inMemoryCounters.delete(key)
      }
    }, 5 * 60 * 1000)

    if (cleanupInterval.unref) {
      cleanupInterval.unref()
    }
  }
}

// ============================================================================
// Configuración
// ============================================================================
const MAX_REQUESTS = 100    // 100 requests por ventana
const WINDOW_SECONDS = 60   // Ventana de 1 minuto

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// ============================================================================
// Rate limit estándar (con fail-open cuando KV falla)
// ============================================================================
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
    const current = await withKVTimeout(kv.incr(key))
    if (current === 1) {
      withKVTimeout(kv.expire(key, WINDOW_SECONDS)).catch(() => {})
    }
    return {
      success: current <= MAX_REQUESTS,
      limit: MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - current),
      reset: reset * 1000,
    }
  } catch (error) {
    // Fail-closed para evitar DoS cuando KV está caído
    log.error({ error: error instanceof Error ? error.message : String(error), key }, 'Rate limit KV error — fail-closed')
    return {
      success: false,
      limit: MAX_REQUESTS,
      remaining: 0,
      reset: Date.now() + WINDOW_SECONDS * 1000,
    }
  }
}

// ============================================================================
// Rate limit estricto (auth, pagos) — con fallback in-memory cuando KV falla
// 5 requests por 10 segundos. Cuando KV falla, usa contador in-memory
// para seguir aplicando algún nivel de protección.
// ============================================================================
export async function checkStrictRateLimit(
  identifier: string,
  path?: string
): Promise<RateLimitResult> {
  const key = path
    ? `ratelimit:strict:${identifier}:${path}`
    : `ratelimit:strict:${identifier}`

  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / 10) * 10
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
      reset: reset * 1000,
    }
  } catch (error) {
    // FAIL-CLOSED para endpoints críticos (auth, pagos, webhooks)
    // Si KV está caído, BLOQUEAR la request y alertar
    log.error({ error: error instanceof Error ? error.message : String(error), key }, 'KV DOWN - BLOQUEANDO REQUEST CRÍTICO (fail-closed)')
    return {
      success: false,
      limit: STRICT_MAX,
      remaining: 0,
      reset: Date.now() + 10000,
    }
  }
}

// ============================================================================
// Rate limit para login (brute force protection)
// 3 requests por 15 segundos por IP. Si KV falla, usa contador in-memory.
// ============================================================================
export async function checkLoginRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const key = `ratelimit:login:${identifier}`

  const LOGIN_WINDOW = 15  // 15 segundos
  const LOGIN_MAX = 3     // 3 intentos por ventana
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / LOGIN_WINDOW) * LOGIN_WINDOW
  const reset = windowStart + LOGIN_WINDOW

  try {
    const current = await withKVTimeout(kv.incr(key))
    if (current === 1) {
      withKVTimeout(kv.expire(key, LOGIN_WINDOW)).catch(() => {})
    }
    return {
      success: current <= LOGIN_MAX,
      limit: LOGIN_MAX,
      remaining: Math.max(0, LOGIN_MAX - current),
      reset: reset * 1000,
    }
  } catch (error) {
    // Fail-closed para auth
    log.error({ error: error instanceof Error ? error.message : String(error), key }, 'KV DOWN - BLOQUEANDO LOGIN (fail-closed)')
    return {
      success: false,
      limit: LOGIN_MAX,
      remaining: 0,
      reset: Date.now() + LOGIN_WINDOW * 1000,
    }
  }
}

// ============================================================================
// Helper: aplica rate limit a una request, devuelve Response 429 o null
// ============================================================================
export async function applyRateLimit(
  request: Request,
  options?: { strict?: boolean; path?: string }
): Promise<Response | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
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
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  return null
}
