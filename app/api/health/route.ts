import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/shared/config'
import { createLogger } from '@/lib/shared/logger'

export const dynamic = 'force-dynamic'

const log = createLogger('API:Health')

/**
 * Health check endpoint for monitoring
 * Returns: 200 if healthy, 503 if unhealthy
 */
export async function GET() {
  const checks = {
    database: false,
    env: false,
    timestamp: new Date().toISOString(),
  }

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Health check: Database connection failed')
  }

  // Check required environment variables
  checks.env = Boolean(
    process.env.DATABASE_URL &&
    process.env.NEXTAUTH_SECRET &&
    process.env.NEXTAUTH_URL
  )

  const isHealthy = checks.database && checks.env

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'error',
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
