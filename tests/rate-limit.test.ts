/**
 * tests/rate-limit.test.ts
 * Verifica el rate limiter: límite estricto, fallback in-memory cuando KV falla,
 * y que el helper applyRateLimit devuelve 429 al superar el límite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Simula un contador KV atómico — se recrea en cada beforeEach
let kvCounter: Record<string, number> = {}

// Implementación estándar del mock (se restaura en beforeEach)
const defaultIncr = async (key: string): Promise<number> => {
  kvCounter[key] = (kvCounter[key] ?? 0) + 1
  return kvCounter[key]
}

const mockKV = {
  incr: vi.fn(defaultIncr),
  expire: vi.fn().mockResolvedValue(true),
}

vi.mock('../lib/kv-client', () => ({ kv: mockKV }))
vi.mock('../lib/shared/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
  }),
}))

const { checkRateLimit, checkStrictRateLimit, applyRateLimit } = await import('../lib/rate-limit-kv')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => {
    kvCounter = {}
    mockKV.incr.mockImplementation(defaultIncr)
    mockKV.expire.mockResolvedValue(true)
  })

  it('permite requests dentro del límite', async () => {
    const result = await checkRateLimit('ip:1.2.3.4')
    expect(result.success).toBe(true)
    expect(result.limit).toBe(100)
    expect(result.remaining).toBe(99)
  })

  it('bloquea cuando se supera el límite de 100', async () => {
    kvCounter['ratelimit:ip:1.2.3.4'] = 100
    const result = await checkRateLimit('ip:1.2.3.4')
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('fail-open cuando KV lanza error', async () => {
    mockKV.incr.mockRejectedValueOnce(new Error('KV connection refused'))
    const result = await checkRateLimit('ip:1.2.3.4')
    // Fail-open: permite la request aunque KV falle
    expect(result.success).toBe(true)
  })
})

describe('checkStrictRateLimit', () => {
  beforeEach(() => {
    kvCounter = {}
    mockKV.incr.mockImplementation(defaultIncr)
    mockKV.expire.mockResolvedValue(true)
  })

  it('límite estricto de 5 requests por 10 segundos', async () => {
    kvCounter['ratelimit:strict:ip:auth'] = 5
    const result = await checkStrictRateLimit('ip', 'auth')
    expect(result.success).toBe(false)
    expect(result.limit).toBe(5)
  })

  it('usa fallback in-memory cuando KV falla — aún bloquea al superar límite', async () => {
    // Rechazar todas las llamadas a incr para simular KV caído
    mockKV.incr.mockRejectedValue(new Error('KV_TIMEOUT'))

    const results: boolean[] = []
    for (let i = 0; i < 6; i++) {
      const r = await checkStrictRateLimit('ip:test-fallback', 'auth-fallback')
      results.push(r.success)
    }

    // Las primeras 5 deben pasar, la 6ta debe ser bloqueada por el fallback in-memory
    const blocked = results.filter(r => !r)
    expect(blocked.length).toBeGreaterThanOrEqual(1)
  })
})

describe('applyRateLimit', () => {
  beforeEach(() => {
    kvCounter = {}
    mockKV.incr.mockImplementation(defaultIncr)
    mockKV.expire.mockResolvedValue(true)
  })

  it('devuelve null cuando no se supera el límite', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    const result = await applyRateLimit(req)
    expect(result).toBeNull()
  })

  it('devuelve Response 429 cuando se supera el límite', async () => {
    kvCounter['ratelimit:10.0.0.2:/api/login'] = 100

    const req = new Request('http://localhost/api/login', {
      headers: { 'x-forwarded-for': '10.0.0.2' },
    })
    const result = await applyRateLimit(req)

    expect(result).not.toBeNull()
    expect(result?.status).toBe(429)

    const body = await result?.json()
    expect(body.error).toBe('Too many requests')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it('incluye headers estándar RateLimit en la respuesta 429', async () => {
    kvCounter['ratelimit:10.0.0.3:/api/test'] = 100

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.3' },
    })
    const result = await applyRateLimit(req)

    expect(result?.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(result?.headers.get('Retry-After')).toBeTruthy()
  })
})
