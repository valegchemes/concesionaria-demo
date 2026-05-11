/**
 * tests/auth.test.ts
 * Tests para verifyCredentials — cubre el anti-timing oracle y los casos de fallo.
 * Los módulos de Prisma y bcrypt se mockean para aislar la lógica de negocio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn()

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
  prismaBypass: {
    user: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}))

// Importar DESPUÉS de definir los mocks
const { verifyCredentials, hashPassword } = await import('../lib/auth')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

async function buildUser(overrides: Record<string, unknown> = {}) {
  const password = await bcrypt.hash('Password123!', 10) // cost 10 para tests rápidos
  return {
    id: 'user-1',
    email: 'test@empresa.com',
    name: 'Test User',
    role: 'ADMIN',
    companyId: 'company-1',
    isActive: true,
    avatarUrl: null,
    password,
    company: { id: 'company-1', isActive: true, slug: 'empresa' },
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('verifyCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna los datos del usuario cuando las credenciales son válidas', async () => {
    const user = await buildUser()
    mockFindFirst.mockResolvedValue(user)

    const result = await verifyCredentials('test@empresa.com', 'Password123!')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('user-1')
    expect(result?.email).toBe('test@empresa.com')
    // No debe exponer el hash de la contraseña
    expect(result).not.toHaveProperty('password')
  })

  it('retorna null cuando el usuario no existe (timing normalizado)', async () => {
    mockFindFirst.mockResolvedValue(null)

    const start = Date.now()
    const result = await verifyCredentials('noexiste@empresa.com', 'cualquier')
    const elapsed = Date.now() - start

    expect(result).toBeNull()
    // El anti-timing oracle debe ejecutar bcrypt.compare aunque el usuario no exista.
    // Mínimo ~50ms incluso con hash dummy (en CI puede variar).
    expect(elapsed).toBeGreaterThan(10)
  })

  it('retorna null con password incorrecta', async () => {
    const user = await buildUser()
    mockFindFirst.mockResolvedValue(user)

    const result = await verifyCredentials('test@empresa.com', 'WrongPassword!')

    expect(result).toBeNull()
  })

  it('retorna null cuando el usuario está inactivo', async () => {
    const user = await buildUser({ isActive: false })
    mockFindFirst.mockResolvedValue(user)

    const result = await verifyCredentials('test@empresa.com', 'Password123!')

    expect(result).toBeNull()
  })

  it('retorna null cuando la empresa está inactiva', async () => {
    const user = await buildUser({ company: { id: 'company-1', isActive: false, slug: 'empresa' } })
    mockFindFirst.mockResolvedValue(user)

    const result = await verifyCredentials('test@empresa.com', 'Password123!')

    expect(result).toBeNull()
  })

  it('filtra por companySlug cuando se provee', async () => {
    const user = await buildUser()
    mockFindFirst.mockResolvedValue(user)

    await verifyCredentials('test@empresa.com', 'Password123!', 'empresa')

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ company: { slug: 'empresa' } }),
      })
    )
  })
})

describe('hashPassword', () => {
  it('genera un hash bcrypt válido con cost 12', async () => {
    const hash = await hashPassword('Password123!')

    // bcryptjs usa $2a$ (formato original) o $2b$ (formato corregido)
    expect(hash).toMatch(/^\$2[ab]\$12\$/)
    expect(await bcrypt.compare('Password123!', hash)).toBe(true)
  })
})
