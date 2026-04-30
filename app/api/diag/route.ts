
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { kv } from '@vercel/kv'
import { head } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Solo permitir acceso si hay una clave secreta en la query o si es desarrollo
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  if (process.env.NODE_ENV === 'production' && secret !== process.env.NEXTAUTH_SECRET?.slice(0, 8)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      HAS_KV: !!(process.env.KV_URL || process.env.KV_REST_API_URL),
      HAS_BLOB: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    checks: {
      database: 'pending',
      kv: 'pending',
      blob: 'pending',
    }
  }

  // 1. DB Check
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    results.checks.database = `OK (${Date.now() - start}ms)`
  } catch (e) {
    results.checks.database = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  // 2. KV Check
  try {
    const start = Date.now()
    await kv.set('diag_test', start)
    const val = await kv.get('diag_test')
    results.checks.kv = `OK (${Date.now() - start}ms, val=${val})`
  } catch (e) {
    results.checks.kv = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  // 3. Blob Check (Optional)
  try {
    const start = Date.now()
    // Solo check si hay token
    if (process.env.BLOB_READ_WRITE_TOKEN) {
       results.checks.blob = `OK (Token present)`
    } else {
       results.checks.blob = `SKIPPED (No token)`
    }
  } catch (e) {
    results.checks.blob = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(results)
}
