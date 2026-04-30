// lib/shared/auth-helpers.ts
// Authentication and authorization utilities

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { UnauthorizedError, ForbiddenError } from './errors'
import { prisma } from './prisma'
import { getUserPermissions, hasPermission, type Permission } from './authz'

export type { Permission }

export async function requireAuth() {
  // Timeout de 5s para getServerSession: si cuelga (bug común en Next.js 15/16), lanzar error rápido
  const session = await Promise.race([
    getServerSession(authOptions),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ])

  if (!session?.user?.companyId) {
    throw new UnauthorizedError('No hay sesión activa o expiró. Por favor iniciá sesión.')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, company: { select: { isActive: true } } }
  })

  if (!user?.isActive) {
    throw new UnauthorizedError('Tu cuenta está desactivada. Contactá al administrador.')
  }

  if (!user.company?.isActive) {
    throw new ForbiddenError('Tu empresa está desactivada. Contactá al administrador.')
  }

  return session
}

/**
 * Get current user with company context and resolved RBAC permissions.
 * Throws UnauthorizedError if no valid session.
 *
 * The returned `permissions` array contains canonical "resource:action"
 * strings (e.g. "deals:manage_all"). Use `hasPermission()` to check them.
 */
export async function getCurrentUser() {
  const session = await requireAuth()
  const user = session.user
  const userId = user.id as string
  const companyId = user.companyId as string

  // Resolve RBAC permissions (Redis cached, falls back to legacy UserRole)
  const permissions = await getUserPermissions(userId, companyId)

  return {
    id: userId,
    email: user.email as string,
    companyId,
    role: user.role as string, // kept for backward compat during migration
    name: (user.name as string) || user.email as string,
    permissions,
  }
}

/**
 * @deprecated Use `requirePermission()` instead — RBAC-based authorization.
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
 * Resolves the current user's permissions and throws ForbiddenError if the
 * required permission is not present. Preferred over `requireRole()`.
 *
 * @example
 *   const user = await requirePermission('units', 'manage_all')
 *   // user.permissions is populated with all permissions
 */
export async function requirePermission(resource: string, action: string) {
  const user = await getCurrentUser()

  if (!hasPermission(user.permissions, resource, action)) {
    throw new ForbiddenError(
      `Permiso denegado: se requiere '${resource}:${action}'`
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

import { headers as nextHeaders } from 'next/headers'

/**
 * Fast-path user extraction from headers injected by middleware.
 *
 * In Next.js 15/16 App Router, middleware-injected headers can be read via:
 * 1. request.headers directly (in Route Handlers, this works reliably)
 * 2. nextHeaders() from 'next/headers' (works in Server Components and Route Handlers)
 *
 * We try BOTH to ensure maximum compatibility. The request object is prioritized
 * because nextHeaders() can throw "called outside a request scope" in some contexts.
 *
 * Falls back to getServerSession() if neither source has the headers.
 * IMPORTANT: Falls back DON'T verify user is still active (no DB check for fast paths).
 * Only use for reads - mutations MUST use getCurrentUser() or requireAuth().
 */
export async function getCurrentUserFromHeaders(request?: Request) {
  // 1. Try request.headers first (most reliable in Route Handlers)
  const reqUserId = request?.headers.get('x-user-id')
  const reqCompanyId = request?.headers.get('x-company-id')
  const reqRole = request?.headers.get('x-user-role')

  if (reqUserId && reqCompanyId) {
    return {
      id: reqUserId,
      companyId: reqCompanyId,
      role: reqRole || 'SELLER',
      email: '',
      name: '',
      permissions: [] as string[],
    }
  }

  // 2. Try next/headers (works in Server Components + some Route Handler contexts)
  try {
    const headersList = await nextHeaders()
    const nhUserId = headersList.get('x-user-id')
    const nhCompanyId = headersList.get('x-company-id')
    const nhRole = headersList.get('x-user-role')

    if (nhUserId && nhCompanyId) {
      return {
        id: nhUserId,
        companyId: nhCompanyId,
        role: nhRole || 'SELLER',
        email: '',
        name: '',
        permissions: [] as string[],
      }
    }
  } catch {
    // nextHeaders() can throw "called outside a request scope" in some contexts
    // This is expected when called from scripts or tests — just fall through
  }

  // 3. Fallback: full session lookup (slowest, but guaranteed)
  return getCurrentUser()
}

/**
 * Check if request has auth headers from middleware (fast-path available).
 * Useful to decide between getCurrentUserFromHeaders vs getCurrentUser.
 */
export async function hasAuthHeaders(request?: Request): Promise<boolean> {
  const hasInReq = !!(request?.headers.get('x-user-id') && request?.headers.get('x-company-id'))
  if (hasInReq) return true

  try {
    const headersList = await nextHeaders()
    return !!(headersList.get('x-user-id') && headersList.get('x-company-id'))
  } catch {
    return false
  }
}
