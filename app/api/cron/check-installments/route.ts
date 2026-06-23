export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/shared/prisma'
import { withLock, LockAcquisitionError } from '@/lib/shared/distributed-lock-fs'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('CronInstallments')
const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/check-installments
 * Called daily by Vercel Cron. Marks overdue installments as OVERDUE.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. Validar autenticación (fail-closed: si CRON_SECRET falta, rechazar)
    const authHeader = req.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      log.warn({ authHeader, hasSecret: Boolean(CRON_SECRET) }, 'Unauthorized cron attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Ejecutar con lock distribuido (previene ejecución concurrente)
    const result = await withLock(
      'cron:check-installments',
      async () => {
        // 3. Timeout de 25s (Vercel límite: 30s para cron)
        return await Promise.race([
          processOverdueInstallments(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Cron timeout after 25s')), 25000)
          ),
        ])
      },
      { ttlSeconds: 300 } // Lock por 5 minutos máximo
    )

    const duration = Date.now() - startTime
    log.info({ updatedCount: result.count, duration }, 'Cron job completed successfully')

    return NextResponse.json({
      ok: true,
      updatedCount: result.count,
      duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime

    if (error instanceof LockAcquisitionError) {
      log.warn({ duration }, 'Cron job already running (lock busy)')
      return NextResponse.json(
        { error: 'Already running', duration },
        { status: 409 }
      )
    }

    log.error(
      {
        error: error instanceof Error ? error.message : String(error),
        duration,
      },
      'Cron job failed'
    )

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      },
      { status: 500 }
    )
  }
}

/**
 * Lógica de negocio: marcar cuotas vencidas
 */
async function processOverdueInstallments() {
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

  return result
}
