import { prisma } from '@/lib/shared/prisma'
import { createLogger } from '@/lib/shared/logger'
import { ActivityType } from '@prisma/client'

const log = createLogger('WhatsAppService')

export class WhatsAppService {
  /**
   * Envía un mensaje de WhatsApp de forma automática (backend).
   * Aplica un throttling para prevenir bloqueos por SPAM de Meta y valida los límites del plan.
   */
  async sendAutomaticMessage({
    companyId,
    userId,
    leadId,
    phone,
    message,
  }: {
    companyId: string
    userId: string
    leadId: string
    phone: string
    message: string
  }) {
    // 1. Validar suscripción y obtener límite
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: { include: { plan: true } } },
    })

    if (!company) {
      throw new Error('Empresa no encontrada.')
    }

    const planName = company.subscription?.plan?.name?.toLowerCase() || ''
    const isPro = planName.includes('pro')
    const isEnterprise = planName.includes('enterprise')
    
    if (!company.subscription?.plan?.whatsappEnabled) {
      throw new Error('El envío de WhatsApp no está incluido en tu plan actual.')
    }

    // 2. Calcular uso diario
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sentTodayCount = await prisma.leadActivity.count({
      where: {
        companyId,
        type: 'WHATSAPP_SENT',
        createdAt: { gte: today },
      },
    })

    // Límite diario: 150 para Pro, 1000 para Enterprise (a convenir)
    const limit = isEnterprise ? 1000 : 150 

    if (sentTodayCount >= limit) {
      log.warn({ companyId, sentTodayCount, limit }, 'Límite diario de WhatsApp alcanzado')
      throw new Error(`Se ha alcanzado el límite diario de ${limit} mensajes automáticos.`)
    }

    // 3. Throttling (Retraso aleatorio de 3 a 7 segundos) para evitar baneos
    const delayMs = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000
    log.info({ companyId, leadId, delayMs }, 'Aplicando throttling a la cola de envío de WhatsApp')
    
    await new Promise((resolve) => setTimeout(resolve, delayMs))

    // 4. Integración real con la API de WhatsApp
    // TODO: Reemplazar con el cliente real de WhatsApp (Baileys / Cloud API)
    log.info({ phone }, 'Simulando envío a la pasarela de WhatsApp...')

    // 5. Registrar actividad para descontar del límite
    await prisma.leadActivity.create({
      data: {
        type: 'WHATSAPP_SENT',
        notes: `Mensaje automático enviado.\n\nContenido: ${message.substring(0, 100)}...`,
        leadId,
        companyId,
        createdById: userId,
      },
    })

    return { 
      success: true, 
      sentToday: sentTodayCount + 1, 
      limit,
      throttledMs: delayMs
    }
  }
}

export const whatsappService = new WhatsAppService()
