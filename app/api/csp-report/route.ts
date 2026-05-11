export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:CSPReport')

/**
 * POST /api/csp-report
 * Receives Content-Security-Policy violation reports from browsers.
 * Compatible with both the old `report-uri` directive and the newer
 * `report-to` / Reporting API format.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let body: unknown = null

    if (contentType.includes('application/json') || contentType.includes('application/csp-report')) {
      body = await request.json()
    }

    const report = (body as Record<string, unknown>)?.['csp-report'] ?? body

    log.warn(
      {
        report: report as Record<string, unknown>,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      },
      'CSP violation reported'
    )

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : String(err) }, 'CSP report parse error')
    return new NextResponse(null, { status: 204 }) // Siempre 204 para no exponer errores
  }
}
