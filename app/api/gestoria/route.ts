export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { prisma } from '@/lib/shared/prisma'
import { withTenantHandler } from '@/lib/shared/with-tenant'

export const GET = withTenantHandler(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser()
    const companyId = user.companyId

    // Obtener todas las unidades activas
    const units = await prisma.unit.findMany({
      where: {
        companyId,
        isActive: true
      },
      select: {
        id: true,
        title: true,
        type: true,
        year: true,
        domain: true,
        status: true,
        attributes: {
          where: {
            key: {
              in: [
                'gestor_cedula',
                'gestor_08',
                'gestor_f12',
                'gestor_dominio',
                'gestor_multas',
                'gestor_patentes',
                'gestor_ceta',
                'gestor_notes'
              ]
            }
          },
          select: {
            key: true,
            value: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    const GESTORIA_KEYS = [
      'gestor_cedula',
      'gestor_08',
      'gestor_f12',
      'gestor_dominio',
      'gestor_multas',
      'gestor_patentes',
      'gestor_ceta'
    ]

    const result = units.map(u => {
      const statuses: Record<string, string> = {}
      GESTORIA_KEYS.forEach(k => {
        const found = u.attributes.find(a => a.key === k)
        statuses[k] = found ? found.value : 'PENDIENTE'
      })

      const notesObj = u.attributes.find(a => a.key === 'gestor_notes')
      const notes = notesObj ? notesObj.value : ''

      // Calcular porcentaje de progreso
      const totalRelevant = GESTORIA_KEYS.filter(k => statuses[k] !== 'NO_APLICA').length
      const totalCompleted = GESTORIA_KEYS.filter(k => statuses[k] === 'COMPLETO').length
      const progressPercent = totalRelevant > 0 ? Math.round((totalCompleted / totalRelevant) * 100) : 0

      // Determinar color de semáforo
      let trafficLight: 'RED' | 'YELLOW' | 'GREEN' = 'RED'
      if (progressPercent === 100) {
        trafficLight = 'GREEN'
      } else if (progressPercent > 0 || GESTORIA_KEYS.some(k => statuses[k] === 'TRAMITE')) {
        trafficLight = 'YELLOW'
      }

      return {
        id: u.id,
        title: u.title,
        type: u.type,
        year: u.year,
        domain: u.domain || 'SIN PATENTE',
        status: u.status,
        progressPercent,
        trafficLight,
        notes,
        statuses
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
