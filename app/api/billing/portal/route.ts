export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { applyRateLimit } from '@/lib/rate-limit-kv'

/**
 * GET /api/billing/portal
 * Devuelve el estado de suscripción actual del tenant.
 * Mercado Pago no tiene un portal de auto-gestión como Stripe;
 * en su lugar mostramos los datos de la suscripción en la UI.
 */
export const GET = withTenantHandler(async (req: NextRequest) => {
  // Rate limit estándar: máx. 60 consultas por minuto por IP
  const blocked = await applyRateLimit(req, { path: '/api/billing/portal' })
  if (blocked) return blocked

  try {
    const user = await getCurrentUser()

    const subscription = await prisma.saasSubscription.findUnique({
      where: { companyId: user.companyId },
      include: { plan: true },
    })

    return NextResponse.json({ subscription })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * POST /api/billing/portal
 * Compatibilidad con la UI existente: devuelve una URL hacia la
 * página de facturación interna (no hay portal externo con MP).
 */
export const POST = withTenantHandler(async (req: NextRequest) => {
  // Rate limit estricto para el POST (evitar abuso de redirecciones)
  const blocked = await applyRateLimit(req, { strict: true, path: '/api/billing/portal' })
  if (blocked) return blocked

  try {
    const baseUrl = process.env.PUBLIC_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    return NextResponse.json({ url: `${baseUrl}/app/settings/billing` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
