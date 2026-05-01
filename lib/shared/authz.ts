/**
 * Authorization Engine (RBAC) — lib/shared/authz.ts
 *
 * PROBLEM SOLVED:
 * The codebase scattered role checks as hardcoded string comparisons
 * (role === 'ADMIN' || role === 'MANAGER') across 10+ files. Adding a
 * new role or granular permission requires touching every file.
 *
 * SOLUTION:
 * A centralized RBAC engine that:
 * 1. Defines a canonical permission taxonomy (resource:action strings)
 * 2. Reads permissions from the relational Role/Permission DB tables
 * 3. Falls back to legacy UserRole enum (ADMIN/MANAGER/SELLER) for
 *    existing users who haven't been migrated yet — zero downtime migration
 * 4. Caches permissions in Redis (Vercel KV) with 1h TTL
 *
 * USAGE:
 *   import { getUserPermissions, hasPermission, PERMISSIONS } from '@/lib/shared/authz'
 *   const perms = await getUserPermissions(userId, companyId)
 *   if (!hasPermission(perms, 'deals', 'manage_all')) throw new ForbiddenError(...)
 */

import { kv } from '@/lib/kv-client'
import { prismaBypass } from '@/lib/shared/prisma'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('AuthZ')

// Cache TTL: 1 hour. Invalidate explicitly on role/permission changes.
const PERMS_CACHE_TTL_SECONDS = 3600

// ============================================================================
// PERMISSION TAXONOMY
// ============================================================================

/**
 * Canonical permission format: "resource:action"
 * Wildcards: "*:*" grants everything
 */
export type Permission = string

/**
 * Full catalog of permissions in the system.
 * All new features MUST add their permissions here first.
 */
export const PERMISSIONS = {
  // ── Deals (Sales Pipeline) ──────────────────────────────────────────────
  /** View your own deals only */
  DEALS_READ_OWN: 'deals:read_own',
  /** View all deals from all sellers */
  DEALS_READ_ALL: 'deals:read_all',
  /** Create/edit/delete your own deals */
  DEALS_MANAGE_OWN: 'deals:manage_own',
  /** Create/edit/delete any deal */
  DEALS_MANAGE_ALL: 'deals:manage_all',

  // ── Leads (CRM) ─────────────────────────────────────────────────────────
  /** View leads assigned to you */
  LEADS_READ_OWN: 'leads:read_own',
  /** View all leads regardless of assignment */
  LEADS_READ_ALL: 'leads:read_all',
  /** Create/edit/delete leads assigned to you */
  LEADS_MANAGE_OWN: 'leads:manage_own',
  /** Create/edit/delete any lead */
  LEADS_MANAGE_ALL: 'leads:manage_all',

  // ── Units (Inventory) ───────────────────────────────────────────────────
  /** View all inventory */
  UNITS_READ_ALL: 'units:read_all',
  /** Create/edit/delete inventory units */
  UNITS_MANAGE_ALL: 'units:manage_all',

  // ── Analytics / Reports ─────────────────────────────────────────────────
  /** View own performance analytics */
  ANALYTICS_READ_OWN: 'analytics:read_own',
  /** View full company analytics */
  ANALYTICS_READ_ALL: 'analytics:read_all',

  // ── Expenses ────────────────────────────────────────────────────────────
  /** View company expenses */
  EXPENSES_READ_ALL: 'expenses:read_all',
  /** Create/edit/delete expenses */
  EXPENSES_MANAGE_ALL: 'expenses:manage_all',

  // ── Team Management ─────────────────────────────────────────────────────
  /** View team members */
  TEAM_READ_ALL: 'team:read_all',
  /** Invite/edit/deactivate team members */
  TEAM_MANAGE_ALL: 'team:manage_all',

  // ── Settings ────────────────────────────────────────────────────────────
  /** View company settings */
  SETTINGS_READ: 'settings:read',
  /** Edit company settings */
  SETTINGS_MANAGE: 'settings:manage',

  // ── Superuser ────────────────────────────────────────────────────────────
  /** Wildcard: grants all permissions */
  ALL: '*:*',
} as const

// ============================================================================
// LEGACY ROLE FALLBACK MAP
// ============================================================================

/**
 * Maps the legacy UserRole enum to granular permissions.
 * Applied when a user has no custom RBAC roles assigned yet.
 * This enables zero-downtime migration: existing users keep working
 * while progressively moving to the relational RBAC system.
 */
const LEGACY_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [PERMISSIONS.ALL],
  MANAGER: [
    PERMISSIONS.DEALS_READ_ALL,
    PERMISSIONS.DEALS_MANAGE_ALL,
    PERMISSIONS.LEADS_READ_ALL,
    PERMISSIONS.LEADS_MANAGE_ALL,
    PERMISSIONS.UNITS_READ_ALL,
    PERMISSIONS.UNITS_MANAGE_ALL,
    PERMISSIONS.ANALYTICS_READ_ALL,
    PERMISSIONS.EXPENSES_READ_ALL,
    PERMISSIONS.EXPENSES_MANAGE_ALL,
    PERMISSIONS.TEAM_READ_ALL,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_MANAGE,
  ],
  SELLER: [
    PERMISSIONS.DEALS_READ_ALL,
    PERMISSIONS.DEALS_MANAGE_OWN,
    PERMISSIONS.LEADS_READ_ALL,
    PERMISSIONS.LEADS_MANAGE_OWN,
    PERMISSIONS.UNITS_READ_ALL,
    PERMISSIONS.UNITS_MANAGE_ALL,
    PERMISSIONS.ANALYTICS_READ_OWN,
  ],
}

// ============================================================================
// PERMISSION CHECK (synchronous — fast path)
// ============================================================================

/**
 * Checks if a set of resolved permissions includes the requested resource:action.
 *
 * Supports wildcards:
 *   - "*:*"       → grants everything
 *   - "units:*"   → grants all actions on the 'units' resource
 *
 * @param permissions - Array of "resource:action" strings for the current user
 * @param resource    - The resource to check (e.g. "deals")
 * @param action      - The action to check (e.g. "manage_all")
 */
export function hasPermission(
  permissions: Permission[],
  resource: string,
  action: string
): boolean {
  if (permissions.includes('*:*')) return true
  if (permissions.includes(`${resource}:${action}`)) return true
  if (permissions.includes(`${resource}:*`)) return true
  return false
}

export function hasAnyPermission(
  permissions: Permission[],
  resource: string,
  actions: string[]
): boolean {
  return actions.some(action => hasPermission(permissions, resource, action))
}

// ============================================================================
// PERMISSION RESOLUTION (async — DB + cache)
// ============================================================================

function cacheKey(userId: string): string {
  return `authz:perms:v1:${userId}`
}

/**
 * Resolves the full permission set for a user.
 *
 * Resolution order:
 * 1. Redis cache (Vercel KV) — TTL: 1h
 * 2. DB — relational RBAC (Role → RolePermission → Permission)
 * 3. Fallback — legacy UserRole enum → LEGACY_ROLE_PERMISSIONS
 *
 * @param userId    - The user's ID
 * @param companyId - The user's company ID (used to scope DB query)
 */
export async function getUserPermissions(
  userId: string,
  companyId: string
): Promise<Permission[]> {
  // ── 1. Cache lookup ──────────────────────────────────────────────────────
  try {
    const cached = await Promise.race([
      kv.get<Permission[]>(cacheKey(userId)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
    ])
    
    if (cached && Array.isArray(cached)) {
      log.debug({ userId }, '[AuthZ] Permission cache HIT')
      return cached
    }
  } catch (err) {
    // Non-blocking: proceed to DB on cache failure
    log.warn({ userId, error: String(err) }, '[AuthZ] KV read error, falling back to DB')
  }

  // ── 2. DB query ──────────────────────────────────────────────────────────
  const user = await prismaBypass.user.findFirst({
    where: { id: userId, companyId },
    select: {
      role: true, // Legacy enum (fallback)
      customRoles: {
        select: {
          permissions: {
            select: {
              permission: {
                select: { resource: true, action: true },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    log.warn({ userId, companyId }, '[AuthZ] User not found during permission resolution')
    return []
  }

  // ── 3. Build permission list ─────────────────────────────────────────────
  let permissions: Permission[]

  const customPerms = user.customRoles.flatMap((role) =>
    role.permissions
      .map((rp) => `${rp.permission.resource}:${rp.permission.action}` as Permission)
  )

  if (customPerms.length > 0) {
    // RBAC roles assigned → use them (deduplicated)
    permissions = [...new Set(customPerms)]
    log.debug({ userId, count: permissions.length }, '[AuthZ] Using relational RBAC permissions')
  } else {
    // Legacy fallback → translate UserRole enum to granular permissions
    permissions = LEGACY_ROLE_PERMISSIONS[user.role] ?? []
    log.debug(
      { userId, legacyRole: user.role, count: permissions.length },
      '[AuthZ] Using legacy role fallback'
    )
  }

  // ── 4. Cache the result ──────────────────────────────────────────────────
  try {
    await kv.set(cacheKey(userId), permissions, { ex: PERMS_CACHE_TTL_SECONDS })
  } catch (err) {
    log.warn({ userId, error: String(err) }, '[AuthZ] Failed to write permission cache')
  }

  return permissions
}

/**
 * Invalidates the permission cache for a specific user.
 * MUST be called whenever a user's roles or permissions are changed.
 *
 * @param userId - The user whose cache should be cleared
 */
export async function invalidateUserPermissions(userId: string): Promise<void> {
  try {
    await kv.del(cacheKey(userId))
    log.info({ userId }, '[AuthZ] Permission cache invalidated')
  } catch (err) {
    log.warn({ userId, error: String(err) }, '[AuthZ] Failed to invalidate permission cache')
  }
}

// ============================================================================
// CONVENIENCE: require permission (throws on failure)
// ============================================================================

/**
 * Resolves permissions for a user and throws ForbiddenError if the
 * required permission is not present. Use this as a gate in API routes.
 *
 * @example
 *   const perms = await requirePermission(userId, companyId, 'units', 'manage_all')
 */
export async function requirePermission(
  userId: string,
  companyId: string,
  resource: string,
  action: string
): Promise<Permission[]> {
  const { ForbiddenError } = await import('@/lib/shared/errors')
  const perms = await getUserPermissions(userId, companyId)
  if (!hasPermission(perms, resource, action)) {
    throw new ForbiddenError(
      `Permiso denegado: se requiere '${resource}:${action}'`
    )
  }
  return perms
}
