/**
 * /api/v1/payments/webhook — Endpoint HISTÓRICO de webhook de Mercado Pago.
 *
 * ADVERTENCIA: Este endpoint era un duplicado débil del canónico
 * `/api/webhooks/mercadopago` (sin tabla de idempotencia, sin rate-limit,
 * sin recuperación stale). Para evitar divergencia de comportamiento y
 * vulnerabilidades, ahora delega al handler canónico.
 *
 * Si Mercado Pago está configurado contra esta URL legacy, seguirá
 * funcionando con las mismas garantías de seguridad que el canónico.
 *
 * Para nuevas configuraciones, usar: POST /api/webhooks/mercadopago
 */

export { POST } from '@/app/api/webhooks/mercadopago/route'
export const dynamic = 'force-dynamic'
