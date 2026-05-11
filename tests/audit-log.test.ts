/**
 * tests/audit-log.test.ts
 * Verifica que sanitizeForAudit elimina campos sensibles correctamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue({ id: 'audit-1' })

vi.mock('../lib/prisma', () => ({
  prismaBypass: {
    auditLog: { create: (...args: unknown[]) => mockCreate(...args) },
  },
  prisma: {},
}))

vi.mock('../lib/shared/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

const { createAuditLog } = await import('../lib/shared/audit-log')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createAuditLog — sanitización de campos sensibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: 'audit-1' })
  })

  const baseEntry = {
    action: 'update',
    resource: 'User',
    resourceId: 'user-1',
    companyId: 'company-1',
    userId: 'user-1',
  }

  it('redacta el campo `password` en el objeto after', async () => {
    await createAuditLog({
      ...baseEntry,
      after: { id: 'user-1', email: 'a@b.com', password: 'hash_secreto_123' },
    })

    const callData = mockCreate.mock.calls[0][0].data
    expect(callData.after).toEqual(
      expect.objectContaining({ password: '[REDACTED]' })
    )
    expect(callData.after).not.toHaveProperty('password', 'hash_secreto_123')
  })

  it('redacta el campo `password` en el objeto before', async () => {
    await createAuditLog({
      ...baseEntry,
      before: { password: 'viejo_hash', email: 'a@b.com' },
    })

    const callData = mockCreate.mock.calls[0][0].data
    expect(callData.before).toMatchObject({ password: '[REDACTED]' })
  })

  it('redacta múltiples campos sensibles a la vez', async () => {
    await createAuditLog({
      ...baseEntry,
      after: {
        password: 'hash',
        token: 'jwt_real',
        apiKey: 'sk-real-key',
        secret: 'topsecret',
        name: 'Juan',
      },
    })

    const { after } = mockCreate.mock.calls[0][0].data
    expect(after.password).toBe('[REDACTED]')
    expect(after.token).toBe('[REDACTED]')
    expect(after.apiKey).toBe('[REDACTED]')
    expect(after.secret).toBe('[REDACTED]')
    expect(after.name).toBe('Juan') // campos no sensibles no se tocan
  })

  it('maneja objetos anidados y arrays recursivamente', async () => {
    await createAuditLog({
      ...baseEntry,
      after: {
        users: [
          { id: '1', password: 'hash1' },
          { id: '2', password: 'hash2' },
        ],
      },
    })

    const { after } = mockCreate.mock.calls[0][0].data
    expect(after.users[0].password).toBe('[REDACTED]')
    expect(after.users[1].password).toBe('[REDACTED]')
  })

  it('preserva datos sin campos sensibles intactos', async () => {
    const safeData = { id: 'deal-1', amount: 1500, status: 'DELIVERED' }
    await createAuditLog({ ...baseEntry, after: safeData })

    const { after } = mockCreate.mock.calls[0][0].data
    expect(after).toEqual(safeData)
  })

  it('no incluye before/after cuando no se proveen', async () => {
    await createAuditLog(baseEntry)

    const callData = mockCreate.mock.calls[0][0].data
    expect(callData.before).toBeUndefined()
    expect(callData.after).toBeUndefined()
  })
})
