/**
 * Tenant Context — Multi-Tenant Isolation via AsyncLocalStorage
 *
 * PROBLEM SOLVED:
 * Previously, tenant isolation (companyId filtering) was done manually in each
 * API route/service, relying on developer discipline. A single forgotten filter
 * would expose one company's data to another — a critical SaaS data breach risk.
 *
 * SOLUTION:
 * This module provides an AsyncLocalStorage-based context that carries the
 * current tenant's companyId through the entire request lifecycle. The Prisma
 * Extension in lib/prisma.ts reads this context and automatically injects
 * the companyId into every query, making it structurally impossible to forget.
 *
 * USAGE in API Routes:
 *   import { withTenantContext } from '@/lib/shared/tenant'
 *   const companyId = request.headers.get('x-company-id')!
 *   return withTenantContext(companyId, async () => { ... your handler ... })
 *
 * BYPASS (for internal scripts/migrations only):
 *   Use `prismaBypass` from '@/lib/prisma' — this skips tenant filtering.
 */

import { AsyncLocalStorage } from 'async_hooks'

// ============================================================================
// ASYNC LOCAL STORAGE
// ============================================================================

interface TenantContext {
  companyId: string
}

// Single global instance — survives across the Node.js module cache
const tenantStorage = new AsyncLocalStorage<TenantContext>()

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Runs a callback within a tenant context.
 * All Prisma queries executed inside the callback will automatically
 * be scoped to the given companyId.
 *
 * @param companyId - The tenant's company ID (from middleware headers)
 * @param fn - The async function to execute within the tenant context
 */
export async function withTenantContext<T>(
  companyId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!companyId) {
    throw new Error('[Tenant] companyId is required to run in tenant context')
  }
  return tenantStorage.run({ companyId }, fn)
}

/**
 * Returns the current tenant's companyId from the async context.
 * Returns `null` if called outside of a tenant context (e.g., in scripts).
 */
export function getCurrentTenantId(): string | null {
  return tenantStorage.getStore()?.companyId ?? null
}

/**
 * Returns the current tenant's companyId and throws if not set.
 * Use this inside service/domain logic that MUST run within a tenant context.
 */
export function requireTenantId(): string {
  const id = getCurrentTenantId()
  if (!id) {
    throw new Error(
      '[Tenant] No tenant context found. Wrap your handler with withTenantContext().'
    )
  }
  return id
}
