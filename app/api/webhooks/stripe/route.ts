export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

/**
 * Este endpoint fue migrado a Mercado Pago.
 * Stripe ya no es el proveedor de pagos de esta aplicación.
 * Webhook activo: /api/webhooks/mercadopago
 */
export async function POST() {
  return new NextResponse(
    'Stripe webhooks are no longer active. See /api/webhooks/mercadopago',
    { status: 410 }
  )
}
