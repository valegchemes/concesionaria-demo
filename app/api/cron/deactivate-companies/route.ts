export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withLock, LockAcquisitionError } from '@/lib/shared/distributed-lock-fs'
import { createLogger } from '@/lib/shared/logger'
import { getDeveloperEmails } from '@/lib/shared/developer-bypass'

const log = createLogger('CronDeactivateCompanies')
const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/deactivate-companies
 * Called daily by Vercel Cron. Soft-deletes companies (isActive = false)
 * that have not had an active subscription for more than 30 days.
 * Protected by CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. Validar autenticación — FAIL-CLOSED: si falta CRON_SECRET, rechazar siempre
    const authHeader = req.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      log.warn({ authHeader: authHeader?.slice(0, 20), hasSecret: !!CRON_SECRET }, 'Unauthorized cron attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Ejecutar con lock distribuido (previene ejecución concurrente)
    const result = await withLock(
      'cron:deactivate-companies',
      async () => {
        // 3. Timeout de 25s (Vercel límite: 30s para cron)
        return await Promise.race([
          processDeactivations(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Cron timeout after 25s')), 25000)
          ),
        ])
      },
      { ttlSeconds: 300 } // Lock por 5 minutos máximo
    )

    const duration = Date.now() - startTime
    log.info({ deactivatedCount: result.count, duration }, 'Cron job completed successfully')

    return NextResponse.json({
      ok: true,
      deactivatedCount: result.count,
      affectedCompanies: result.affectedNames,
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
 * Lógica de negocio: buscar y desactivar compañías
 */
async function processDeactivations() {
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - 30) // 30 days ago

  // 1. Identify companies that need to be deactivated
  const targetCompanies = await prisma.company.findMany({
    where: {
      isActive: true, // Only look at currently active companies
      OR: [
        // A) Subscription expired or canceled over 30 days ago
        {
          subscription: {
            status: { notIn: ['ACTIVE', 'INCOMPLETE'] },
            currentPeriodEnd: { lt: thresholdDate }
          }
        },
        // B) No subscription ever created, and the company was created over 30 days ago
        {
          subscription: null,
          createdAt: { lt: thresholdDate }
        }
      ],
      // Permanent Exemption: Exclude any company where a developer user exists
      users: {
        none: {
          email: { in: Array.from(getDeveloperEmails()) }
        }
      }
    },
    select: { id: true, name: true }
  })

  if (targetCompanies.length === 0) {
    return { count: 0, affectedNames: [] }
  }

  const companyIds = targetCompanies.map(c => c.id)

  // 2. Perform the soft-delete
  const result = await prisma.company.updateMany({
    where: { id: { in: companyIds } },
    data: { isActive: false, updatedAt: new Date() }
  })

  return {
    count: result.count,
    affectedNames: targetCompanies.map(c => c.name)
  }
}
