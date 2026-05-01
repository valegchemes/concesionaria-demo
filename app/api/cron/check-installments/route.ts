export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/check-installments
 * Called daily by Vercel Cron. Marks overdue installments as OVERDUE.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await prisma.installment.updateMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: today },
    },
    data: {
      status: 'OVERDUE',
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, updatedCount: result.count })
}
