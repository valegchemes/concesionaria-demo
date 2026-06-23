export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { errorResponse } from '@/lib/shared/api-response'

// Validación Zod del payload de transacción de caja. Antes se validaba a mano
// con Number() y coercion silenciosa de moneda inválida a 'ARS' (podía
// contabilizar USD como ARS sin avisar). Ahora rechazamos con 400.
const CashTransactionSchema = z.object({
  amount: z.number().finite().positive().max(100_000_000_000),
  currency: z.enum(['ARS', 'USD']),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  concept: z.string().trim().min(1).max(300),
})

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    if (user.role === 'SELLER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Verificar si hay una sesión abierta
    const activeSession = await prisma.cashSession.findFirst({
      where: { companyId, status: 'OPEN' }
    })

    if (!activeSession) {
      return NextResponse.json({ success: false, error: 'Debe abrir una sesión de caja antes de registrar movimientos.' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = CashTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { amount, currency, type, concept } = parsed.data

    const transaction = await prisma.cashTransaction.create({
      data: {
        companyId,
        sessionId: activeSession.id,
        amount,
        currency,
        type,
        concept,
        referenceType: 'MANUAL'
      }
    })

    return NextResponse.json({ success: true, data: transaction })
  } catch (error: unknown) {
    // No filtrar el mensaje interno al cliente; el helper errorResponse ya lo
    // trata correctamente (solo expone detalles en development).
    return errorResponse(error, { path: '/api/finance/transactions', method: 'POST' })
  }
})
