export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { errorResponse } from '@/lib/shared/api-response'

export const GET = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    if (user.role === 'SELLER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Buscar sesión abierta
    let session = await prisma.cashSession.findFirst({
      where: { companyId, status: 'OPEN' },
      select: {
        id: true,
        status: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        closingBalance: true,
        actualBalance: true,
        notes: true,
        userId: true,
        transactions: {
          select: {
            id: true,
            createdAt: true,
            concept: true,
            type: true,
            amount: true,
            currency: true,
          },
        },
        user: { select: { name: true } },
      }
    })

    let isHistory = false
    // Si no hay abierta, buscar la última cerrada
    if (!session) {
      session = await prisma.cashSession.findFirst({
        where: { companyId, status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        select: {
          id: true,
          status: true,
          openedAt: true,
          closedAt: true,
          openingBalance: true,
          closingBalance: true,
          actualBalance: true,
          notes: true,
          userId: true,
          transactions: {
            select: {
              id: true,
              createdAt: true,
              concept: true,
              type: true,
              amount: true,
              currency: true,
            },
          },
          user: { select: { name: true } },
        }
      })
      isHistory = true
    }

    if (!session) {
      return NextResponse.json({ success: true, data: null })
    }

    const openedAt = session.openedAt
    const closedAt = session.closedAt || new Date()

    // 1. Obtener cobros de operaciones (DealPayment)
    const dealPayments = await prisma.dealPayment.findMany({
      where: {
        deal: { companyId },
        createdAt: { gte: openedAt, lte: closedAt }
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        currency: true,
        method: true,
        deal: {
          select: {
            unit: { select: { title: true } },
            lead: { select: { name: true } }
          }
        }
      }
    })

    // 2. Obtener cobros de cuotas (InstallmentPayment)
    const installmentPayments = await prisma.installmentPayment.findMany({
      where: {
        installment: {
          promissoryNote: { companyId }
        },
        createdAt: { gte: openedAt, lte: closedAt }
      },
      select: {
        id: true,
        createdAt: true,
        amount: true,
        method: true,
        installment: {
          select: {
            installmentNumber: true,
            promissoryNote: {
              select: {
                currency: true,
                unit: { select: { title: true } },
                lead: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    // 3. Obtener gastos generales (CompanyExpense)
    const companyExpenses = await prisma.companyExpense.findMany({
      where: {
        companyId,
        isActive: true,
        createdAt: { gte: openedAt, lte: closedAt }
      },
      select: {
        id: true,
        createdAt: true,
        category: true,
        description: true,
        amountArs: true,
        amountUsd: true,
      },
      take: 500
    })

    // 4. Obtener gastos de unidades (UnitCostItem)
    const unitCosts = await prisma.unitCostItem.findMany({
      where: {
        unit: { companyId },
        date: { gte: openedAt, lte: closedAt }
      },
      select: {
        id: true,
        date: true,
        concept: true,
        amountArs: true,
        amountUsd: true,
        unit: { select: { title: true } }
      },
      take: 500
    })

    // Integrar movimientos unificados
    const unifiedTransactions: any[] = []

    // A. Manuales de CashTransaction
    for (const t of session.transactions) {
      unifiedTransactions.push({
        id: t.id,
        date: t.createdAt,
        concept: t.concept,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        method: 'CASH',
        source: 'MANUAL'
      })
    }

    // B. DealPayments
    for (const dp of dealPayments) {
      unifiedTransactions.push({
        id: dp.id,
        date: dp.createdAt,
        concept: `Cobro Seña/Pago: ${dp.deal.unit.title} (${dp.deal.lead.name})`,
        type: 'INFLOW',
        amount: Number(dp.amount),
        currency: dp.currency,
        method: dp.method,
        source: 'DEAL_PAYMENT'
      })
    }

    // C. InstallmentPayments
    for (const ip of installmentPayments) {
      const pn = ip.installment.promissoryNote
      unifiedTransactions.push({
        id: ip.id,
        date: ip.createdAt,
        concept: `Cobro Cuota #${ip.installment.installmentNumber}: ${pn.unit.title} (${pn.lead.name})`,
        type: 'INFLOW',
        amount: Number(ip.amount),
        currency: pn.currency,
        method: ip.method,
        source: 'INSTALLMENT_PAYMENT'
      })
    }

    // D. CompanyExpenses
    for (const ce of companyExpenses) {
      unifiedTransactions.push({
        id: ce.id,
        date: ce.createdAt,
        concept: `Gasto: ${ce.category}${ce.description ? ` (${ce.description})` : ''}`,
        type: 'OUTFLOW',
        amount: Number(ce.amountArs) > 0 ? Number(ce.amountArs) : Number(ce.amountUsd),
        currency: Number(ce.amountArs) > 0 ? 'ARS' : 'USD',
        method: 'CASH',
        source: 'COMPANY_EXPENSE'
      })
    }

    // E. UnitCosts
    for (const uc of unitCosts) {
      unifiedTransactions.push({
        id: uc.id,
        date: uc.date,
        concept: `Gasto Prep. ${uc.unit.title}: ${uc.concept}`,
        type: 'OUTFLOW',
        amount: Number(uc.amountArs) > 0 ? Number(uc.amountArs) : Number(uc.amountUsd),
        currency: Number(uc.amountArs) > 0 ? 'ARS' : 'USD',
        method: 'CASH',
        source: 'UNIT_COST'
      })
    }

    // Ordenar transacciones por fecha descendente
    unifiedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Calcular saldos teóricos consolidados
    let totalInflowArs = 0
    let totalInflowUsd = 0
    let totalOutflowArs = 0
    let totalOutflowUsd = 0

    for (const t of unifiedTransactions) {
      if (t.type === 'INFLOW') {
        if (t.currency === 'USD') totalInflowUsd += t.amount
        else totalInflowArs += t.amount
      } else {
        if (t.currency === 'USD') totalOutflowUsd += t.amount
        else totalOutflowArs += t.amount
      }
    }

    const openingBalanceArs = Number(session.openingBalance)
    const expectedBalanceArs = openingBalanceArs + totalInflowArs - totalOutflowArs
    const expectedBalanceUsd = totalInflowUsd - totalOutflowUsd

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          openingBalance: openingBalanceArs,
          closingBalance: session.closingBalance ? Number(session.closingBalance) : null,
          actualBalance: session.actualBalance ? Number(session.actualBalance) : null,
          notes: session.notes,
          userName: session.user.name,
        },
        transactions: unifiedTransactions,
        totals: {
          totalInflowArs,
          totalInflowUsd,
          totalOutflowArs,
          totalOutflowUsd,
          expectedBalanceArs,
          expectedBalanceUsd
        },
        isHistory
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

// Validación Zod de la acción de sesión de caja (discriminada por `action`).
// Antes se validaba con Number() sobre entrada cruda, lo que producía NaN y
// aceptaba acciones inválidas cayendo en un 400 genérico sin detalles.
const CashSessionActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('OPEN'),
    openingBalance: z.number().finite().nonnegative().max(100_000_000_000).default(0),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('CLOSE'),
    closingBalance: z.number().finite().nonnegative().max(100_000_000_000).default(0),
    actualBalance: z.number().finite().nonnegative().max(100_000_000_000).default(0),
    notes: z.string().trim().max(1000).optional(),
  }),
])

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    if (user.role === 'SELLER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = CashSessionActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const data = parsed.data

    if (data.action === 'OPEN') {
      // Verificar si ya hay una abierta
      const active = await prisma.cashSession.findFirst({
        where: { companyId, status: 'OPEN' }
      })
      if (active) {
        return NextResponse.json({ success: false, error: 'Ya existe una sesión de caja abierta.' }, { status: 400 })
      }

      const session = await prisma.cashSession.create({
        data: {
          companyId,
          userId: user.id,
          openingBalance: data.openingBalance,
          notes: data.notes ?? '',
          status: 'OPEN'
        }
      })

      return NextResponse.json({ success: true, data: session })
    }

    // data.action === 'CLOSE'
    const active = await prisma.cashSession.findFirst({
      where: { companyId, status: 'OPEN' }
    })
    if (!active) {
      return NextResponse.json({ success: false, error: 'No hay ninguna sesión de caja activa para cerrar.' }, { status: 400 })
    }

    const session = await prisma.cashSession.update({
      where: { id: active.id },
      data: {
        closedAt: new Date(),
        closingBalance: data.closingBalance,
        actualBalance: data.actualBalance,
        status: 'CLOSED',
        notes: data.notes ?? active.notes
      }
    })

    return NextResponse.json({ success: true, data: session })
  } catch (error: unknown) {
    return errorResponse(error, { path: '/api/finance/session', method: 'POST' })
  }
})
