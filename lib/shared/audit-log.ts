import { prismaBypass } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { type Prisma } from '@prisma/client'

// Campos que nunca deben persistirse en el audit log
const SENSITIVE_FIELDS = ['password', 'hashedPassword', 'token', 'secret', 'apiKey']

/**
 * Elimina campos sensibles de un objeto antes de guardarlo en el audit log.
 * Trabaja recursivamente sobre objetos y arrays.
 */
function sanitizeForAudit(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForAudit)

  // Convertir tipos especiales de Prisma/JS a primitivos JSON-serializables
  // Decimal.js (Prisma Decimal) tiene toNumber() — detectar por duck-typing
  if (typeof (obj as Record<string, unknown>)['toNumber'] === 'function') {
    return (obj as { toNumber: () => number }).toNumber()
  }
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'bigint') return Number(obj)

  const sanitized = { ...(obj as Record<string, unknown>) }
  for (const [key, value] of Object.entries(sanitized)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForAudit(value)
    }
  }
  return sanitized
}

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
  userId: string | null
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
      data.before = sanitizeForAudit(entry.before) as Prisma.InputJsonValue
    }

    if (entry.after !== undefined) {
      data.after = sanitizeForAudit(entry.after) as Prisma.InputJsonValue
    }

    return await prismaBypass.auditLog.create({ data })
  } catch (error) {
    // El audit log es una operación no crítica — nunca debe interrumpir el flujo principal.
    // El error queda registrado en los logs para diagnóstico, pero la operación continúa.
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to create audit log entry — operation continues'
    )
  }
}
