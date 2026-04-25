// lib/shared/auth-helpers.ts
// Authentication and authorization utilities

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { UnauthorizedError, ForbiddenError } from './errors'
import { prisma } from './prisma'

export async function requireAuth() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.companyId) {
    throw new UnauthorizedError('No hay sesión activa. Por favor iniciá sesión.')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, company: { select: { isActive: true } } }
  })
  console.log("User: ", user)

  if (!user?.isActive) {
    throw new UnauthorizedError('Tu cuenta está desactivada. Contactá al administrador.')
  }

  if (!user.company?.isActive) {
    throw new ForbiddenError('Tu empresa está desactivada. Contactá al administrador.')
  }

  return session
}

/**
 * Get current user with company context.
 * Throws UnauthorizedError if no valid session.
 */
export async function getCurrentUser() {
  const session = await requireAuth()
  const user = session.user

  return {
    id: user.id as string,
    email: user.email as string,
    companyId: user.companyId as string,
    role: user.role as string,
    name: (user.name as string) || user.email as string,
  }
}

/**
 * Check if user has a specific role.
 * Throws ForbiddenError if user doesn't have the required role.
 */
export async function requireRole(requiredRole: string | string[]) {
  const user = await getCurrentUser()
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  if (!requiredRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Esta acción requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`
    )
  }

  return user
}

/**
 * Ensure user has access to the specified company.
 * Throws ForbiddenError if user is accessing another company's data.
 */
export async function requireCompanyAccess(companyId: string) {
  const user = await getCurrentUser()

  if (user.companyId !== companyId) {
    throw new ForbiddenError('No tenés acceso a esta empresa')
  }

  return user
}

/**
 * Extract tenant ID from session (for multi-tenant safety).
 * Always use this instead of trusting user input for companyId.
 */
export async function getTenantId(): Promise<string> {
  const user = await getCurrentUser()
  return user.companyId
}
