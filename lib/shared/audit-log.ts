import { prismaBypass } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('AuditLog')

export type AuditLogEntry = {
  action: string
  resource: string
  resourceId?: string
  before?: unknown
  after?: unknown
  ipAddress?: string
  userAgent?: string
  reason?: string
  companyId: string
  userId: string
}

export async function createAuditLog(entry: AuditLogEntry) {
  try {
    return await prismaBypass.auditLog.create({
      data: {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        reason: entry.reason,
        companyId: entry.companyId,
        userId: entry.userId,
      },
    })
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error), entry },
      'Failed to create audit log entry'
    )
    throw error
  }
}
