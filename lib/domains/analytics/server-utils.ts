import { kv } from '@/lib/kv-client'
import { analyticsCacheKeys, TimeRange } from './types'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('Analytics:Cache')

export async function invalidateAnalyticsCache(companyId: string) {
  try {
    // Las claves en route.ts se generan como: \`analytics:v8:\${companyId}:\${type}:\${timeRange}:\${userId}\`
    // Buscamos todas las claves que contengan el companyId y las borramos.
    const pattern = \`*\${companyId}*\`
    const keys = await kv.keys(pattern)

    if (keys.length > 0) {
      await kv.del(...keys)
      log.info({ companyId, keysCount: keys.length }, 'Analytics cache invalidated')
    }
  } catch (error) {
    log.error({ error: String(error), companyId }, 'Failed to invalidate analytics cache')
  }
}
