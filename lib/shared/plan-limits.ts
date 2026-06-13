import { prisma } from '@/lib/prisma'
import { hasDeveloperInCompany, getDeveloperEmails } from '@/lib/shared/developer-bypass'

export interface PlanLimits {
  planName: string
  maxUsers: number
  maxUnits: number
  analyticsEnabled: boolean
  whatsappEnabled: boolean
  documentsEnabled: boolean
  auditEnabled: boolean
  aiEnabled: boolean
  isActive: boolean
}

// Fallback for companies with no active subscription
const FREE_LIMITS: PlanLimits = {
  planName: 'Sin plan',
  maxUsers: 1,
  maxUnits: 5,
  analyticsEnabled: false,
  whatsappEnabled: false,
  documentsEnabled: false,
  auditEnabled: false,
  aiEnabled: false,
  isActive: false,
}

/**
 * Returns the plan limits for a given company.
 * If there's no active subscription or no plan assigned, returns free tier limits.
 * This is the single source of truth for enforcement in API routes.
 */
export async function getPlanLimits(companyId: string): Promise<PlanLimits> {

  // 1. Developer Bypass (Superadmin): Siempre tiene Plan Pro Activo sin importar suscripción.
  // El cliente extendido de Prisma es compatible con el tipo simplificado que espera hasDeveloperInCompany
  const isDeveloper = await hasDeveloperInCompany(prisma as any, companyId)

  if (isDeveloper) {
    return {
      planName: 'Plan Pro (Developer)',
      maxUsers: 999,
      maxUnits: 9999,
      analyticsEnabled: true,
      whatsappEnabled: true,
      documentsEnabled: true,
      auditEnabled: true,
      aiEnabled: true,
      isActive: true,
    }
  }

  // 2. Normal Tenant Flow
  const subscription = await prisma.saasSubscription.findUnique({
    where: { companyId },
    include: { plan: true },
  })

  // Los inquilinos normales SI O SI deben tener su pago confirmado y la suscripción ACTIVE
  if (!subscription || subscription.status !== 'ACTIVE' || !subscription.plan) {
    return FREE_LIMITS
  }

  const { plan } = subscription
  const isPro = plan.name.toLowerCase().includes('pro')
  return {
    planName: plan.name,
    maxUsers: plan.maxUsers,
    maxUnits: plan.maxUnits,
    analyticsEnabled: plan.analyticsEnabled,
    whatsappEnabled: plan.whatsappEnabled,
    documentsEnabled: plan.documentsEnabled,
    auditEnabled: plan.auditEnabled,
    aiEnabled: isPro,
    isActive: true,
  }
}

/**
 * Checks if a company can add more users.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export async function canAddUser(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getPlanLimits(companyId)
  const currentUsers = await prisma.user.count({ where: { companyId } })

  if (currentUsers >= limits.maxUsers) {
    return {
      allowed: false,
      reason: `Tu plan "${limits.planName}" permite hasta ${limits.maxUsers} usuario${limits.maxUsers === 1 ? '' : 's'}. Actualizá tu plan para agregar más.`,
    }
  }
  return { allowed: true }
}

/**
 * Checks if a company can add more inventory units.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export async function canAddUnit(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getPlanLimits(companyId)
  const currentUnits = await prisma.unit.count({ where: { companyId, status: 'AVAILABLE', isActive: true } })

  if (currentUnits >= limits.maxUnits) {
    return {
      allowed: false,
      reason: `Tu plan "${limits.planName}" permite hasta ${limits.maxUnits} unidades en inventario. Actualizá tu plan para agregar más.`,
    }
  }
  return { allowed: true }
}
