import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

/**
 * Hash ficticio usado para normalizar el timing de respuesta cuando el usuario
 * no existe. Previene timing oracle attacks que permiten enumerar emails válidos.
 * (bcrypt cost 12, valor fijo — nunca coincidirá con ninguna contraseña real)
 */
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LFBNBLPfQ1vbK7Sm2'

export async function verifyCredentials(email: string, password: string, companySlug: string) {
  // SECURITY: `companySlug` es OBLIGATORIO para garantizar el aislamiento entre
  // tenants en el login. Antes era opcional: si se omitía, se hacía
  // `findFirst({ where: { email } })` sin scoping de tenant, lo que permitía
  // autenticarse contra el primer email coincidente entre TODAS las empresas
  // (confusión de tenant). El formulario de login siempre lo envía.
  const user = await prisma.user.findFirst({
    where: {
      email,
      company: {
        slug: companySlug,
      },
    },
    include: {
      company: true,
    },
  })

  // SIEMPRE ejecutar bcrypt para normalizar el tiempo de respuesta.
  // Si el usuario no existe, comparamos contra el dummy hash (siempre falla).
  const hashToCompare = user?.password ?? DUMMY_HASH
  const isValid = await bcrypt.compare(password, hashToCompare)

  if (!user || !isValid || !user.isActive || !user.company.isActive) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    company: user.company,
    avatarUrl: user.avatarUrl,
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12) // cost factor 12: recomendado para 2025+
}
