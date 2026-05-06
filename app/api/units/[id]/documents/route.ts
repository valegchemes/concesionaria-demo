export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { z } from 'zod'

const CreateDocSchema = z.object({
  type: z.enum(['BOLETO_COMPRAVENTA', 'RECIBO', 'CONTRATO']),
  leadId: z.string(),
  amount: z.number().optional(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  notes: z.string().optional(),
  // Extra metadata fields for the PDF template
  buyerDni: z.string().optional(),
  buyerAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentConditions: z.string().optional(),
  signatureDataUrl: z.string().optional(),
})

/** Prefix map for auto-reference numbers */
const PREFIX: Record<string, string> = {
  BOLETO_COMPRAVENTA: 'BOL',
  RECIBO: 'REC',
  CONTRATO: 'CON',
}

/** Generate correlative reference number: BOL-0001 */
async function generateRefNumber(type: string, companyId: string): Promise<string> {
  const prefix = PREFIX[type] ?? 'DOC'
  const count = await prisma.digitalDocument.count({
    where: { companyId, type: type as any },
  })
  return `${prefix}-${String(count + 1).padStart(4, '0')}`
}

/**
 * GET /api/units/[id]/documents — List documents for a unit
 */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id: unitId } = await params

    const docs = await prisma.digitalDocument.findMany({
      where: { unitId, companyId: user.companyId },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(docs)
  }
)

/**
 * POST /api/units/[id]/documents — Create a new document
 */
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getCurrentUser()
    const { id: unitId } = await params
    const body = await req.json()
    const data = CreateDocSchema.parse(body)

    // Verify unit belongs to this company
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, companyId: user.companyId },
    })
    if (!unit) throw new Error('Unit not found')

    // Verify lead belongs to this company
    const lead = await prisma.lead.findFirst({
      where: { id: data.leadId, companyId: user.companyId },
    })
    if (!lead) throw new Error('Lead not found')

    // Verify company details
    const company = await prisma.company.findFirst({
      where: { id: user.companyId },
    })
    if (!company) throw new Error('Company not found')

    const referenceNumber = await generateRefNumber(data.type, user.companyId)

    // Snapshot all relevant data into metadata so the PDF is always reproducible
    const metadata = {
      // Concesionaria
      companyName: company.name,
      companyCuit: (company as any).cuit ?? '',
      companyAddress: (company as any).address ?? '',
      // Comprador
      buyerName: lead.name,
      buyerPhone: lead.phone,
      buyerEmail: lead.email ?? '',
      buyerDni: data.buyerDni ?? '',
      buyerAddress: data.buyerAddress ?? '',
      // Vehículo
      unitTitle: unit.title,
      unitVin: unit.vin ?? '',
      unitDomain: unit.domain ?? '',
      unitEngineNumber: unit.engineNumber ?? '',
      unitFrameNumber: unit.frameNumber ?? '',
      unitYear: (unit as any).year ?? '',
      // Financiero
      amount: data.amount ?? 0,
      currency: data.currency,
      paymentMethod: data.paymentMethod ?? '',
      paymentConditions: data.paymentConditions ?? '',
      // Misc
      notes: data.notes ?? '',
      issuedAt: new Date().toISOString(),
      issuedBy: (user as any).name ?? user.companyId,
      signatureDataUrl: data.signatureDataUrl ?? '',
    }

    const doc = await prisma.digitalDocument.create({
      data: {
        type: data.type as any,
        referenceNumber,
        amount: data.amount,
        status: 'GENERATED',
        metadata,
        unitId,
        leadId: data.leadId,
        companyId: user.companyId,
        updatedAt: new Date(),
      },
      include: {
        lead: { select: { id: true, name: true } },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'DigitalDocument',
        resourceId: doc.id,
        after: { type: data.type, referenceNumber },
        companyId: user.companyId,
        userId: user.id,
      },
    })

    return successResponse(doc, 201)
  }
)
