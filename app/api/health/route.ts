import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/shared/config'

export const dynamic = 'force-dynamic'

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
    console.error('Health check: Database connection failed', error)
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
      status: isHealthy ? 'healthy' : 'unhealthy',
      ...checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
