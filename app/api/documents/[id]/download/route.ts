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
        pdf.fontSize(20).text('DIAGNOSTICO DE PDF', { align: 'center' })
        pdf.moveDown()
        pdf.fontSize(12).text(`Documento: ${docTitle}`)
        pdf.text(`Referencia: ${doc.referenceNumber}`)
        pdf.text(`Cliente: ${m.buyerName}`)
        pdf.text(`Monto: ${m.amount}`)
        pdf.moveDown()
        pdf.text('Si ves esto, el motor de PDF funciona. Reinstalando diseño original...')
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
