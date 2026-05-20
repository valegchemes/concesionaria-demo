export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { unitService } from '@/lib/domains/units/service'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'
import PDFDocument from 'pdfkit'

function generatePdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', (err) => reject(err))
    doc.end()
  })
}

function formatPriceSimple(value: number, currency: string): string {
  if (currency === 'USD') {
    return `US$ ${value.toLocaleString('es-AR')}`
  }
  return `$ ${value.toLocaleString('es-AR')}`
}

export const GET = withTenantHandler(withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id } = await params

    // Fetch the unit detail
    const unit = await unitService.getById(id, user.companyId)
    if (!unit) {
      return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 })
    }

    // Fetch company info
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        name: true,
        phone: true,
        email: true,
      }
    })

    // Extract query parameters for simulation
    const searchParams = request.nextUrl.searchParams
    const priceParam = searchParams.get('price')
    const downPaymentParam = searchParams.get('downPayment')
    const monthsParam = searchParams.get('months')
    const interestRateParam = searchParams.get('interestRate')
    const financingTypeParam = searchParams.get('financingType') || 'fixed'

    const price = priceParam ? parseFloat(priceParam) : Number(unit.priceUsd || unit.priceArs || 0)
    const downPayment = downPaymentParam ? parseFloat(downPaymentParam) : Math.round(price * 0.4)
    const months = monthsParam ? parseInt(monthsParam) : 36
    const interestRate = interestRateParam ? parseFloat(interestRateParam) : 48
    const financingType = financingTypeParam as 'fixed' | 'uva' | 'usd'

    const currencySymbol = financingType === 'usd' ? 'USD' : 'ARS'
    const totalToFinance = Math.max(0, price - downPayment)
    const downPaymentPercent = price > 0 ? Math.round((downPayment / price) * 100) : 0

    // Standard French System Amortization Formula
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

    const totalRepayment = monthlyInstallment * months
    const totalInterest = Math.max(0, totalRepayment - totalToFinance)

    // Generate PDF using pdfkit
    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    // Header Background
    doc.rect(0, 0, 595.28, 110)
      .fill('#4338ca') // indigo-700

    // Title
    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('PROPUESTA DE FINANCIACIÓN', 40, 35)

    // Company Name
    doc.fontSize(12)
      .font('Helvetica')
      .text((company?.name || 'AUTOMANAGER CRM').toUpperCase(), 40, 65)

    // Contact Details under Header
    doc.fillColor('#e2e8f0')
      .fontSize(9)
      .text(`Generado el ${new Date().toLocaleDateString('es-AR')} | AutoManager CRM`, 40, 82)

    // Draw Section Header: Vehículo
    doc.fillColor('#1e293b') // slate-800
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Vehículo Seleccionado', 40, 140)

    // Draw Line
    doc.moveTo(40, 160)
      .lineTo(555.28, 160)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke()

    // Vehicle Details
    doc.fillColor('#334155') // slate-700
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Unidad / Modelo:', 40, 175)
      .font('Helvetica')
      .text(unit.title, 160, 175)

    if (unit.year) {
      doc.font('Helvetica-Bold')
        .text('Año:', 40, 195)
        .font('Helvetica')
        .text(String(unit.year), 160, 195)
    }

    if (unit.domain) {
      doc.font('Helvetica-Bold')
        .text('Patente / Dominio:', 40, 215)
        .font('Helvetica')
        .text(unit.domain.toUpperCase(), 160, 215)
    }

    // Financing details box (grey rounded box)
    const boxY = 245
    doc.roundedRect(40, boxY, 515.28, 165, 8)
      .fillColor('#f8fafc')
      .fill()

    doc.roundedRect(40, boxY, 515.28, 165, 8)
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .stroke()

    // Content inside details box
    doc.fillColor('#1e293b')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Detalles del Financiamiento', 60, boxY + 18)

    // Parameters
    const labelX = 60
    const valX = 260
    let currentY = boxY + 45
    const rowHeight = 20

    const rows = [
      { label: 'Precio de la unidad:', val: formatPriceSimple(price, currencySymbol) },
      { label: 'Anticipo / Entrega acordada:', val: `${formatPriceSimple(downPayment, currencySymbol)} (${downPaymentPercent}%)` },
      { label: 'Saldo neto a financiar:', val: formatPriceSimple(totalToFinance, currencySymbol) },
      { label: 'Plazo del préstamo:', val: `${months} meses (cuotas)` },
      { label: 'Tasa Nominal Anual (TNA):', val: `${interestRate}% TNA / French` },
      { label: 'Tipo de Financiación:', val: financingType === 'fixed' ? 'Pesos - Cuotas Fijas' : financingType === 'uva' ? 'Pesos - Cuotas UVA' : 'Dólares Billete' }
    ]

    doc.fontSize(10)
    rows.forEach((row) => {
      doc.fillColor('#475569') // slate-600
        .font('Helvetica')
        .text(row.label, labelX, currentY)
      doc.fillColor('#0f172a') // slate-900
        .font('Helvetica-Bold')
        .text(row.val, valX, currentY)
      currentY += rowHeight
    })

    // Indigo Installment Display box
    const instY = boxY + 190
    doc.roundedRect(40, instY, 515.28, 55, 8)
      .fillColor('#4338ca')
      .fill()

    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('CUOTA MENSUAL ESTIMADA:', 60, instY + 22)

    doc.fontSize(22)
      .text(formatPriceSimple(monthlyInstallment, currencySymbol), 300, instY + 17)

    // Legal disclaimer footer
    doc.fillColor('#64748b')
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text('* Esta cotización es un simulador preliminar y no implica aprobación crediticia definitiva.', 40, instY + 80)
      .text('* Cuotas e intereses calculados bajo amortización de Sistema Francés.', 40, instY + 92)

    if (company?.phone || company?.email) {
      doc.font('Helvetica-Bold')
        .text(`Consultas o contacto: ${company.phone || ''} ${company.email ? '| ' + company.email : ''}`, 40, instY + 110)
    }

    const pdfBuffer = await generatePdfBuffer(doc)

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Cotizacion_${unit.title.replace(/\s+/g, '_')}.pdf`,
      },
    })
  }
))
