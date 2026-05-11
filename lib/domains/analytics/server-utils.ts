import { kv } from '@/lib/kv-client'
import { analyticsCacheKeys, TimeRange } from './types'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('Analytics:Cache')

export async function invalidateAnalyticsCache(companyId: string) {
  try {
    const types: (keyof typeof analyticsCacheKeys)[] = ['dashboard', 'salesProfit', 'topSellers', 'costs']
    const ranges: TimeRange[] = ['7d', '30d', '90d', '1y', 'all']
    const keys: string[] = []

    for (const t of types) {
      for (const r of ranges) {
        keys.push(analyticsCacheKeys[t](companyId, r))
      }
    }

    if (keys.length > 0) {
      await kv.del(...keys)
      log.info({ companyId, keysCount: keys.length }, 'Analytics cache invalidated')
    }
  } catch (error) {
    log.error({ error: String(error), companyId }, 'Failed to invalidate analytics cache')
  }
}
