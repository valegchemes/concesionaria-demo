import { prisma } from '@/lib/prisma'
import { getMPPreference } from './mercadopago'
import { createLogger } from '@/lib/shared/logger'
import { SubscriptionStatus } from '@prisma/client'

const log = createLogger('BillingService')

// Status map shared between helpers
const statusMap: Record<string, SubscriptionStatus> = {
  authorized: 'ACTIVE',
  paused: 'PAUSED',
  cancelled: 'CANCELED',
  pending: 'INCOMPLETE',
}

export const billingService = {
  /**
   * Obtiene o crea un registro de suscripción local para un Tenant dado.
   * Con Mercado Pago no existe un "customerId" centralizado como en Stripe;
   * devolvemos el companyId como identificador externo.
   */
  async getOrCreateCustomer(companyId: string): Promise<string> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true },
    })

    if (!company) {
      throw new Error(`Company not found: ${companyId}`)
    }

    // Si ya existe una suscripción local, reutilizamos el companyId
    if (company.subscription) {
      return companyId
    }

    // Crear registro vacío de suscripción
    await prisma.saasSubscription.create({
      data: {
        companyId: company.id,
        status: 'INCOMPLETE',
      },
    })

    return companyId
  },

  async getAllowedPlans() {
    return prisma.saasPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        stripePriceId: true,
        price: true,
        currency: true,
        interval: true,
        maxUsers: true,
        maxUnits: true,
        analyticsEnabled: true,
        whatsappEnabled: true,
        documentsEnabled: true,
        auditEnabled: true,
      },
      orderBy: { price: 'asc' },
    })
  },

  async getPlanByStripePriceId(planId: string) {
    return prisma.saasPlan.findUnique({
      where: { stripePriceId: planId },
      select: {
        id: true,
        name: true,
        description: true,
        stripePriceId: true,
        price: true,
        currency: true,
        interval: true,
        maxUsers: true,
        maxUnits: true,
        analyticsEnabled: true,
        whatsappEnabled: true,
        documentsEnabled: true,
        auditEnabled: true,
        isActive: true,
      },
    })
  },

  /**
   * Crea una preferencia de pago en Mercado Pago para el plan dado.
   */
  async createCheckoutPreference({
    companyId,
    userId,
    planId,
    planName,
    planDescription,
    price,
    currency,
    successUrl,
    failureUrl,
    pendingUrl,
  }: {
    companyId: string
    userId: string
    planId: string
    planName: string
    planDescription: string | null
    price: number
    currency: string
    successUrl: string
    failureUrl: string
    pendingUrl: string
  }) {
    const preference = getMPPreference()

    const result = await preference.create({
      body: {
        items: [
          {
            id: planId,
            title: planName,
            description: planDescription ?? planName,
            quantity: 1,
            unit_price: Number(price),
            currency_id: currency.toUpperCase(),
          },
        ],
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: 'approved',
        external_reference: JSON.stringify({ companyId, userId, planId }),
        statement_descriptor: 'AutoFlow CRM',
        expires: false,
      },
    })

    return result
  },

  /**
   * Sincroniza el estado de la suscripción a partir de un pago de Mercado Pago.
   */
  async syncSubscriptionFromPayment({
    paymentId,
    status,
    externalReference,
  }: {
    paymentId: string
    status: string
    externalReference: string | null
  }) {
    if (!externalReference) {
      log.error({ paymentId }, 'Payment missing external_reference')
      throw new Error('Payment missing external_reference')
    }

    let parsed: { companyId: string; userId: string; planId: string }
    try {
      parsed = JSON.parse(externalReference)
    } catch {
      log.error({ externalReference }, 'Invalid external_reference JSON')
      throw new Error('Invalid external_reference format')
    }

    const { companyId, planId } = parsed
    const mappedStatus = statusMap[status] ?? 'INCOMPLETE'

    log.info({ paymentId, status, companyId, planId }, 'Syncing MP payment to subscription')

    const existing = await prisma.saasSubscription.findFirst({
      where: { companyId },
    })

    if (existing) {
      await prisma.saasSubscription.update({
        where: { id: existing.id },
        data: {
          status: mappedStatus,
          mpPaymentId: paymentId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        },
      })
    } else {
      await prisma.saasSubscription.create({
        data: {
          companyId,
          status: mappedStatus,
          mpPaymentId: paymentId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    }
  },
}
