export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'

export const GET = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    const tradeIns = await prisma.tradeIn.findMany({
      where: {
        deal: { companyId },
        isConverted: false
      },
      include: {
        deal: {
          select: {
            id: true,
            finalPriceCurrency: true,
            lead: { select: { name: true } },
            unit: { select: { title: true } }
          }
        }
      },
      orderBy: { id: 'desc' }
    })

    const mapped = tradeIns.map(t => ({
      id: t.id,
      description: t.description,
      expectedValue: Number(t.expectedValue),
      offeredValue: Number(t.offeredValue),
      finalValue: Number(t.finalValue),
      dealId: t.dealId,
      currency: t.deal?.finalPriceCurrency || 'ARS',
      clientName: t.deal?.lead?.name || 'Cliente',
      sourceUnitTitle: t.deal?.unit?.title || 'Unidad Vendida'
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    const body = await request.json()
    const {
      tradeInId,
      title,
      type,
      year,
      domain,
      vin,
      engineNumber,
      acquisitionCostArs,
      acquisitionCostUsd,
      priceArs,
      priceUsd
    } = body

    if (!tradeInId) {
      return NextResponse.json({ success: false, error: 'tradeInId es requerido' }, { status: 400 })
    }

    if (!title || !type) {
      return NextResponse.json({ success: false, error: 'Título y Tipo son requeridos' }, { status: 400 })
    }

    const tradeIn = await prisma.tradeIn.findFirst({
      where: {
        id: tradeInId,
        deal: { companyId }
      }
    })

    if (!tradeIn) {
      return NextResponse.json({ success: false, error: 'Vehículo en parte de pago no encontrado.' }, { status: 404 })
    }

    if (tradeIn.isConverted) {
      return NextResponse.json({ success: false, error: 'Este usado ya fue ingresado al inventario.' }, { status: 400 })
    }

    // Iniciar transacción de base de datos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear la Unidad en inventario
      const newUnit = await tx.unit.create({
        data: {
          companyId,
          title,
          type,
          year: year ? parseInt(year, 10) : null,
          domain: domain || null,
          vin: vin || null,
          engineNumber: engineNumber || null,
          acquisitionCostArs: acquisitionCostArs ? Number(acquisitionCostArs) : null,
          acquisitionCostUsd: acquisitionCostUsd ? Number(acquisitionCostUsd) : null,
          priceArs: priceArs ? Number(priceArs) : null,
          priceUsd: priceUsd ? Number(priceUsd) : null,
          acquisitionType: 'TRADE_IN',
          status: 'IN_PREP',
          isFromTradeIn: true,
          tradeInId: tradeIn.id,
          createdById: user.id
        }
      })

      // 2. Marcar el TradeIn como convertido
      await tx.tradeIn.update({
        where: { id: tradeIn.id },
        data: {
          isConverted: true,
          convertedAt: new Date(),
          convertedToUnitId: newUnit.id
        }
      })

      return newUnit
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
