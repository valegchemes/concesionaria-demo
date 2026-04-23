import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function verifyCredentials(email: string, password: string, companySlug?: string) {
  // Buscar usuario por email y company (si se proporciona slug)
  let user
  
  if (companySlug) {
    user = await prisma.user.findFirst({
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
  } else {
    user = await prisma.user.findFirst({
      where: {
        email,
      },
      include: {
        company: true,
      },
    })
  }

  if (!user) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.password)

  if (!isValid) {
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
  return bcrypt.hash(password, 10)
}
