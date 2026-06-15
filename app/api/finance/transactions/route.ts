export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'

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
    const { amount, currency, type, concept } = body

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser un número positivo.' }, { status: 400 })
    }

    if (!concept || concept.trim() === '') {
      return NextResponse.json({ success: false, error: 'El concepto del movimiento es requerido.' }, { status: 400 })
    }

    const VALID_CURRENCIES = ['ARS', 'USD']

    if (type !== 'INFLOW' && type !== 'OUTFLOW') {
      return NextResponse.json({ success: false, error: 'El tipo de movimiento debe ser INFLOW (Ingreso) o OUTFLOW (Egreso).' }, { status: 400 })
    }

    const validatedCurrency = VALID_CURRENCIES.includes(currency) ? currency : 'ARS'

    const transaction = await prisma.cashTransaction.create({
      data: {
        companyId,
        sessionId: activeSession.id,
        amount: Number(amount),
        currency: validatedCurrency,
        type,
        concept: concept.trim(),
        referenceType: 'MANUAL'
      }
    })

    return NextResponse.json({ success: true, data: transaction })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
