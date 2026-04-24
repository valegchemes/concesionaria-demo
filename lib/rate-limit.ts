export const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
export const MAX_REQUESTS = 10
export const WINDOW_MS = 60 * 1000

export function checkRateLimit(ip: string, path: string): boolean {
  const key = `${ip}:${path}`
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export function cleanExpiredRateLimits() {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

setInterval(cleanExpiredRateLimits, 5 * 60 * 1000)