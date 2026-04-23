// lib/shared/auth-helpers.ts
// Authentication and authorization utilities

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { UnauthorizedError, ForbiddenError } from './errors'

const DEMO_USER_ID = 'demo-user-id'
const DEMO_COMPANY_ID = 'demo-company-id'
const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@example.com',
  companyId: DEMO_COMPANY_ID,
  role: 'ADMIN',
  name: 'Demo User',
}

/**
 * Get current user session
 * Returns demo user if no session (demo mode)
 */
export async function requireAuth() {
  try {
    const session = await getServerSession(authOptions)
    
    // If we have a real session with company, use it
    if (session?.user?.companyId) {
      return session
    }
    
    // Otherwise return demo user (demo mode)
    return { user: DEMO_USER }
  } catch {
    // If auth fails, return demo user
    return { user: DEMO_USER }
  }
}

/**
 * Get current user with company context
 * Returns demo user if no real session
 */
export async function getCurrentUser() {
  const session = await requireAuth()

  // Ensure user has company context (should always have it in demo mode)
  const user = session.user
  
  return {
    id: user.id as string,
    email: user.email as string,
    companyId: user.companyId as string || DEMO_COMPANY_ID,
    role: user.role as string || 'ADMIN',
    name: user.name || 'Demo User',
  }
}

/**
 * Check if user has a specific role
 * Throws ForbiddenError if user doesn't have the required role
 */
export async function requireRole(requiredRole: string | string[]) {
  const user = await getCurrentUser()
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  if (!requiredRoles.includes(user.role)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${requiredRoles.join(', ')}`
    )
  }

  return user
}

/**
 * Ensure user has access to the specified company
 * Throws ForbiddenError if user is accessing another company's data
 */
export async function requireCompanyAccess(companyId: string) {
  const user = await getCurrentUser()

  if (user.companyId !== companyId) {
    throw new ForbiddenError('You do not have access to this company')
  }

  return user
}

/**
 * Extract tenant ID from session (for multi-tenant safety)
 * Always use this instead of trusting user input for companyId
 */
export async function getTenantId(): Promise<string> {
  const user = await getCurrentUser()
  return user.companyId
}
