export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/shared/crypto'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('MigrateGmail')

export async function POST(req: NextRequest) {
  try {
    // Protección simple - solo en producción con header secreto
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.MIGRATE_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connections = await prisma.gmailConnection.findMany({
      where: {
        accessTokenEnc: null,
        accessToken: { not: null }
      },
      select: { companyId: true, accessToken: true, refreshToken: true }
    })

    if (connections.length === 0) {
      return NextResponse.json({ message: 'No hay tokens legacy para migrar', migrated: 0 })
    }

    let migrated = 0
    for (const conn of connections) {
      try {
        await prisma.gmailConnection.update({
          where: { companyId: conn.companyId },
          data: {
            accessTokenEnc: encrypt(conn.accessToken!),
            refreshTokenEnc: encrypt(conn.refreshToken!),
            accessToken: null,
            refreshToken: null,
          }
        })
        migrated++
        log.info({ companyId: conn.companyId }, 'Gmail tokens migrados')
      } catch (e) {
        log.error({ companyId: conn.companyId, err: String(e) }, 'Error migrando')
      }
    }

    return NextResponse.json({ 
      message: `Migración completada: ${migrated}/${connections.length} empresas`,
      migrated 
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}