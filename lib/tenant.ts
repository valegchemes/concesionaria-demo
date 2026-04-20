import { prisma } from './prisma'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

export async function getCurrentCompanyId(): Promise<string> {
  const session = await getServerSession()
  
  if (!session?.user?.companyId) {
    throw new Error('No companyId in session')
  }
  
  return session.user.companyId
}

export async function resolveCompanyFromHost(host: string) {
  // Remover puerto si existe
  const cleanHost = host.split(':')[0]
  
  // Verificar si es localhost o dominio de desarrollo
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    // En desarrollo, usar slug de query param o default
    return null
  }
  
  // Quitar www. si existe
  const domain = cleanHost.replace(/^www\./, '')
  
  // Buscar por custom domain primero
  const companyByDomain = await prisma.company.findUnique({
    where: { customDomain: domain },
  })
  
  if (companyByDomain) {
    return companyByDomain
  }
  
  // Buscar por slug (subdominio)
  // Formato esperado: {slug}.tuapp.com
  const slug = domain.split('.')[0]
  
  const companyBySlug = await prisma.company.findUnique({
    where: { slug },
  })
  
  return companyBySlug
}

export async function getCompanyFromRequest(req: NextRequest) {
  const host = req.headers.get('host') || ''
  return resolveCompanyFromHost(host)
}

export function withCompanyFilter<T extends Record<string, unknown>>(
  data: T,
  companyId: string
): T & { companyId: string } {
  return {
    ...data,
    companyId,
  }
}
