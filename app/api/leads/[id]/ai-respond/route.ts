export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createLogger } from '@/lib/shared/logger'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import { getPlanLimits } from '@/lib/shared/plan-limits'

const log = createLogger('API:LeadAiRespond')

const requestSchema = z.object({
  selectedUnitId: z.string().nullable().optional(),
  clientQuestion: z.string().optional().default(''),
  price: z.number().min(0),
  downPayment: z.number().min(0),
  interestRate: z.number().min(0).max(300),
  financingType: z.enum(['fixed', 'uva', 'usd']),
  monthsOptions: z.array(z.number().min(1).max(120)).default([12, 24, 36, 48]),
})

export const POST = withTenantHandler(async (
  request: NextRequest,
  context?: unknown
) => {
  const { id } = await (context as { params: Promise<{ id: string }> }).params
  try {
    const session = await requireAuth()

    // 1. Fetch lead and verify access
    const lead = await prisma.lead.findFirst({
      where: { id, companyId: session.user.companyId },
      select: { id: true, name: true, assignedToId: true, createdById: true },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    const canManageAll = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'
    const canAccessLead =
      canManageAll ||
      lead.assignedToId === session.user.id ||
      lead.createdById === session.user.id

    if (!canAccessLead) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 })
    }

    // Check plan limits for AI features
    const limits = await getPlanLimits(session.user.companyId)
    if (!limits.aiEnabled) {
      return NextResponse.json({ error: 'Tu plan no incluye las funciones de Inteligencia Artificial.' }, { status: 403 })
    }

    // 2. Parse request parameters
    const body = await request.json()
    const validated = requestSchema.parse(body)
    const { selectedUnitId, clientQuestion, price, downPayment, interestRate, financingType, monthsOptions } = validated

    // 3. Fetch selected unit if present
    let selectedUnit = null
    if (selectedUnitId) {
      selectedUnit = await prisma.unit.findFirst({
        where: { id: selectedUnitId, companyId: session.user.companyId, isActive: true },
        include: { attributes: true }
      })
    }

    // 4. Fetch other available units in stock (limit to 10 for context token limits)
    const availableUnits = await prisma.unit.findMany({
      where: {
        companyId: session.user.companyId,
        isActive: true,
        status: 'AVAILABLE',
        NOT: selectedUnitId ? { id: selectedUnitId } : undefined
      },
      select: {
        id: true,
        title: true,
        priceArs: true,
        priceUsd: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    const availableUnitsList = availableUnits.length > 0
      ? availableUnits.map(u => {
          const priceStr = u.priceUsd ? `USD ${Number(u.priceUsd).toLocaleString('es-AR')}` : u.priceArs ? `$ ${Number(u.priceArs).toLocaleString('es-AR')} ARS` : 'Consultar precio'
          return `- ${u.title}: ${priceStr}`
        }).join('\n')
      : 'No hay otros vehículos disponibles en stock actualmente.'

    // 5. Mathematically calculate French System Amortization monthly installments
    const totalToFinance = Math.max(0, price - downPayment)
    const calculatedInstallments = monthsOptions.map(months => {
      let monthlyInstallment = 0
      if (totalToFinance > 0) {
        if (interestRate <= 0) {
          monthlyInstallment = Math.round(totalToFinance / months)
        } else {
          const monthlyRate = (interestRate / 12) / 100
          const installment = totalToFinance * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
          monthlyInstallment = isNaN(installment) || !isFinite(installment) ? 0 : Math.round(installment)
        }
      }
      return { months, monthlyInstallment }
    })

    const currencySymbol = financingType === 'usd' ? 'USD' : 'ARS'
    const formatCurrency = (val: number) => {
      if (financingType === 'usd') {
        return `US$ ${val.toLocaleString('es-AR')}`
      }
      return `$ ${val.toLocaleString('es-AR')}`
    }

    // 6. Call Gemini API
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({ error: 'La clave GEMINI_API_KEY no está configurada.' }, { status: 500 })
    }

    // Construct precise financing markdown table & URLs
    const installmentPlanStr = calculatedInstallments.map(ins => {
      const pdfUrl = `/api/units/${selectedUnitId || 'dummy'}/financing-pdf?price=${price}&downPayment=${downPayment}&interestRate=${interestRate}&months=${ins.months}&financingType=${financingType}`
      return `- **${ins.months} cuotas** de **${formatCurrency(ins.monthlyInstallment)}** al mes. [Descargar PDF de ${ins.months} meses](${pdfUrl})`
    }).join('\n')

    const unitUrl = selectedUnitId ? `/u/${selectedUnitId}` : ''

    const prompt = `Actuá como un asesor comercial y vendedor de autos sumamente profesional y persuasivo en Argentina para la concesionaria.
Tu nombre o el de la empresa es el configurado para el lead.
Tu objetivo es responder de forma cálida, prolija y con excelente tono comercial al siguiente mensaje de consulta del cliente (llamado ${lead.name}):
"${clientQuestion}"

Información del vehículo y plan de financiación para armar la propuesta:
- Vehículo de interés: ${selectedUnit?.title || 'No especificado'}
- Precio de lista: ${formatCurrency(price)}
- Anticipo / Entrega inicial acordada: ${formatCurrency(downPayment)} (Financiás el saldo restante de ${formatCurrency(totalToFinance)})
- Tasa de Interés Anual (TNA): ${interestRate}%
- Modalidad: ${financingType === 'fixed' ? 'Cuotas Fijas en Pesos' : financingType === 'uva' ? 'Cuotas ajustadas por UVA' : 'Cuotas fijas en Dólares'}

Aquí tenés los importes de cuotas exactos calculados matemáticamente. DEBÉS utilizar exactamente estos montos en tu respuesta, no inventes otros números:
${installmentPlanStr}

Otras unidades disponibles en stock por si quiere ver alternativas de precio o gama:
${availableUnitsList}

Reglas de estilo:
1. Usá el pronombre "vos" (voseo rioplatense argentino de asesor de concesionaria), con mucha calidez, cortesía y entusiasmo.
2. Sé muy estructurado. Presentá el plan de cuotas de forma limpia y legible usando viñetas o negritas, ideal para leerse por WhatsApp o correo.
3. Asegurate de incluir los enlaces de descarga de PDF que te pasé en el listado para que el cliente pueda descargar su propuesta formal.
${selectedUnitId ? `4. Si el cliente quiere ver la ficha técnica completa del auto con fotos oficiales, incluí este enlace de la web: [Ver Ficha de la Unidad](${unitUrl})` : ''}
5. Finalizá invitándolo a visitar la concesionaria para probar el auto o coordinar una llamada para cerrar el plan según sus posibilidades.

Devolvé únicamente el texto redactado de la propuesta, listo para enviar.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
          }
        })
      }
    )

    if (!response.ok) {
      const errData = await response.json()
      log.error({ error: errData }, 'Error from Gemini API')
      return NextResponse.json({ error: 'Error al comunicarse con la IA.' }, { status: 500 })
    }

    const resJson = await response.json()
    const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta.'

    return NextResponse.json({
      success: true,
      data: generatedText
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in ai-respond route')
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
})
