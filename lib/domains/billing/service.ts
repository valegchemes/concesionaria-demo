import { prisma } from '@/lib/prisma'
import { stripe } from './stripe'
import { createLogger } from '@/lib/shared/logger'
import { SubscriptionStatus } from '@prisma/client'

const log = createLogger('BillingService')

export const billingService = {
  /**
   * Obtiene o crea un cliente en Stripe para un Tenant dado
   */
  async getOrCreateCustomer(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true }
    })

    if (!company) {
      throw new Error(`Company not found: ${companyId}`)
    }

    if (company.subscription?.stripeCustomerId) {
      return company.subscription.stripeCustomerId
    }

    // Crear cliente en Stripe
    const customer = await stripe.customers.create({
      email: company.email,
      name: company.name,
      metadata: {
        companyId: company.id
      }
    })

    // Registrarlo en nuestra BD local creando una suscripción vacía
    await prisma.saasSubscription.create({
      data: {
        companyId: company.id,
        stripeCustomerId: customer.id,
        status: 'INCOMPLETE'
      }
    })

    return customer.id
  },

  /**
   * Sincroniza el estado de la suscripción desde Stripe hacia nuestra BD
   */
  async syncSubscriptionStatus(stripeSubscriptionId: string) {
    log.info({ stripeSubscriptionId }, 'Syncing subscription from Stripe')
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    // Aquí guardamos el estado a nuestra BD
    const localSub = await prisma.saasSubscription.findUnique({
      where: { stripeSubscriptionId: subscription.id }
    })

    if (localSub) {
      // Mapeamos el status. Stripe y nosotros usamos nomenclaturas similares, 
      // pero en prisma definimos un Enum.
      const statusMap: Record<string, SubscriptionStatus> = {
        'trailing': 'TRIALING',
        'active': 'ACTIVE',
        'past_due': 'PAST_DUE',
        'canceled': 'CANCELED',
        'unpaid': 'UNPAID',
        'incomplete': 'INCOMPLETE',
        'incomplete_expired': 'INCOMPLETE_EXPIRED',
        'paused': 'PAUSED'
      }

      await prisma.saasSubscription.update({
        where: { id: localSub.id },
        data: {
          status: statusMap[subscription.status] || 'INCOMPLETE',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        }
      })
    } else {
      // Find customer
      const customerId = subscription.customer as string
      const localCustomer = await prisma.saasSubscription.findUnique({
        where: { stripeCustomerId: customerId }
      })

      if (localCustomer) {
        const statusMap: Record<string, SubscriptionStatus> = {
          'trailing': 'TRIALING',
          'active': 'ACTIVE',
          'past_due': 'PAST_DUE',
          'canceled': 'CANCELED',
          'unpaid': 'UNPAID',
          'incomplete': 'INCOMPLETE',
          'incomplete_expired': 'INCOMPLETE_EXPIRED',
          'paused': 'PAUSED'
        }

        await prisma.saasSubscription.update({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscription.id,
            status: statusMap[subscription.status] || 'INCOMPLETE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          }
        })
      }
    }
  }
}
