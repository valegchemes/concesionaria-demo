import { prismaBypass } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { type Prisma } from '@prisma/client'

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
    const data = {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      reason: entry.reason,
      company: { connect: { id: entry.companyId } },
      ...(entry.userId ? { user: { connect: { id: entry.userId } } } : {}),
    } as Prisma.AuditLogCreateInput

    if (entry.before !== undefined) {
      data.before = entry.before as Prisma.InputJsonValue
    }

    if (entry.after !== undefined) {
      data.after = entry.after as Prisma.InputJsonValue
    }

    return await prismaBypass.auditLog.create({ data })
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error), entry },
      'Failed to create audit log entry'
    )
    throw error
  }
}
