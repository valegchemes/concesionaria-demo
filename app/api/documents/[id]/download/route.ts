export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import PDFDocument from 'pdfkit'

const DOC_LABELS: Record<string, string> = {
  BOLETO_COMPRAVENTA: 'BOLETO DE COMPRAVENTA',
  RECIBO: 'RECIBO DE PAGO',
  CONTRATO: 'CONTRATO',
}

/**
 * GET /api/documents/[id]/download
 * Generates a PDF on-the-fly from stored metadata and streams it to the browser.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    const doc = await prisma.digitalDocument.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const m = doc.metadata as Record<string, any>
    const docTitle = DOC_LABELS[doc.type] ?? 'DOCUMENTO'
    const issueDate = new Date(m.issuedAt ?? doc.createdAt).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const pdf = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: any[] = []
    pdf.on('data', (c) => chunks.push(c))

    await new Promise<void>((resolve, reject) => {
      pdf.on('end', resolve)
      pdf.on('error', (err) => {
        console.error('PDFKit error:', err)
        reject(err)
      })

      try {
        const W = pdf.page.width
        const dark = '#1e293b'
        const accent = '#4f46e5'
        const muted = '#64748b'
        const line = '#e2e8f0'

        // ── Header bar ──────────────────────────────────────────────────────────
        pdf.rect(0, 0, W, 80).fill(accent)
        pdf.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
          .text(m.companyName ?? 'Concesionaria', 50, 25)
        pdf.fontSize(9).font('Helvetica').fillColor('#c7d2fe')
          .text(`CUIT: ${m.companyCuit ?? '—'}  |  ${m.companyAddress ?? ''}`, 50, 52)

        // ── Document title ───────────────────────────────────────────────────────
        pdf.moveDown(3)
        pdf.fontSize(16).font('Helvetica-Bold').fillColor(dark)
          .text(docTitle, { align: 'center' })
        pdf.fontSize(10).font('Helvetica').fillColor(muted)
          .text(`N° ${doc.referenceNumber ?? '—'}  |  Fecha de emisión: ${issueDate}`, { align: 'center' })
        pdf.moveDown(0.5)
        pdf.moveTo(50, pdf.y).lineTo(W - 50, pdf.y).strokeColor(line).lineWidth(1).stroke()

        // ── Helper: section heading ──────────────────────────────────────────────
        const sectionTitle = (title: string) => {
          pdf.moveDown(1)
          pdf.rect(50, pdf.y, W - 100, 22).fill('#f1f5f9')
          pdf.fontSize(10).font('Helvetica-Bold').fillColor(accent)
            .text(title, 58, pdf.y + 5)
          pdf.moveDown(1.2)
        }

        // ── Helper: row ──────────────────────────────────────────────────────────
        const row = (label: string, value: string) => {
          const y = pdf.y
          pdf.fontSize(9).font('Helvetica-Bold').fillColor(muted)
            .text(label, 55, y, { width: 160 })
          pdf.fontSize(9).font('Helvetica').fillColor(dark)
            .text(String(value || '—'), 220, y, { width: W - 270 })
          pdf.moveDown(0.7)
        }

        // ── Datos de la Concesionaria ────────────────────────────────────────────
        sectionTitle('DATOS DE LA CONCESIONARIA / VENDEDOR')
        row('Razón Social:', m.companyName)
        row('CUIT:', m.companyCuit)
        row('Domicilio:', m.companyAddress)

        // ── Datos del Comprador ──────────────────────────────────────────────────
        sectionTitle('DATOS DEL COMPRADOR')
        row('Nombre / Razón Social:', m.buyerName)
        row('DNI / CUIT:', m.buyerDni)
        row('Domicilio:', m.buyerAddress)
        row('Teléfono:', m.buyerPhone)
        row('Email:', m.buyerEmail)

        // ── Datos del Vehículo ───────────────────────────────────────────────────
        sectionTitle('DATOS DEL VEHÍCULO')
        row('Descripción:', m.unitTitle)
        row('Año:', String(m.unitYear ?? ''))
        row('Dominio / Patente:', m.unitDomain)
        row('N° de Chasis / VIN:', m.unitVin || m.unitFrameNumber)
        row('N° de Motor:', m.unitEngineNumber)

        // ── Condiciones de compraventa ───────────────────────────────────────────
        sectionTitle('CONDICIONES DE LA OPERACIÓN')
        const currency = m.currency ?? 'ARS'
        const amountStr = m.amount
          ? `${currency} ${Number(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          : '—'
        row('Precio de Venta:', amountStr)
        row('Forma de Pago:', m.paymentMethod)
        row('Condiciones:', m.paymentConditions)
        if (m.notes) row('Observaciones:', m.notes)

        // ── Cláusulas legales ────────────────────────────────────────────────────
        pdf.moveDown(1)
        pdf.moveTo(50, pdf.y).lineTo(W - 50, pdf.y).strokeColor(line).lineWidth(0.5).stroke()
        pdf.moveDown(0.5)
        pdf.fontSize(7.5).font('Helvetica').fillColor(muted)
          .text(
            'El comprador declara haber revisado el vehículo y encontrarlo en condiciones satisfactorias. ' +
            'La transferencia de dominio queda sujeta a la normativa del Registro Nacional de la Propiedad del Automotor. ' +
            'Cualquier deuda, infracción o impuesto anterior a la fecha de esta operación es responsabilidad del vendedor. ' +
            'Las partes declaran conformidad con lo aquí expresado y firman en señal de aceptación.',
            50, pdf.y, { width: W - 100, align: 'justify' }
          )

        // ── Firmas ───────────────────────────────────────────────────────────────
        const sigY = pdf.y + 40
        if (sigY + 70 > pdf.page.height - 50) {
          pdf.addPage()
        }
        pdf.moveDown(3)
        const sigTop = pdf.y
        // Vendedor
        pdf.moveTo(55, sigTop + 40).lineTo(230, sigTop + 40).strokeColor(dark).lineWidth(0.8).stroke()
        pdf.fontSize(8).font('Helvetica').fillColor(muted)
          .text('Firma Vendedor / Concesionaria', 55, sigTop + 45, { width: 175, align: 'center' })
        // Comprador
        pdf.moveTo(W - 230, sigTop + 40).lineTo(W - 55, sigTop + 40).strokeColor(dark).lineWidth(0.8).stroke()
        pdf.fontSize(8).font('Helvetica').fillColor(muted)
          .text('Firma Comprador', W - 230, sigTop + 45, { width: 175, align: 'center' })

        // ── Footer ───────────────────────────────────────────────────────────────
        pdf.fontSize(7).fillColor('#94a3b8')
          .text(
            `Documento generado electrónicamente • ${m.companyName} • ${issueDate}`,
            50, pdf.page.height - 30, { align: 'center', width: W - 100 }
          )

        pdf.end()
      } catch (e) {
        reject(e)
      }
    })

    const pdfBuffer = Buffer.concat(chunks)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="test.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[document/download]', err)
    return NextResponse.json({ 
      error: 'ERROR_PDF_DIAGNOSTIC', 
      details: err instanceof Error ? err.message : String(err) 
    }, { status: 500 })
  }
}
