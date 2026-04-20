import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // Skip API and static routes
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // Check if accessing app routes (protected)
  if (pathname.startsWith('/app') || pathname.startsWith('/login')) {
    return NextResponse.next()
  }

  // Try to resolve company from host
  const company = await resolveCompanyFromHost(host)

  if (company) {
    // Rewrite to catalog routes with company context
    const url = request.nextUrl.clone()
    
    // Store company info in headers for the page to access
    const response = NextResponse.rewrite(url)
    response.headers.set('x-company-id', company.id)
    response.headers.set('x-company-slug', company.slug)
    
    return response
  }

  return NextResponse.next()
}

async function resolveCompanyFromHost(host: string) {
  const cleanHost = host.split(':')[0]
  
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return null
  }
  
  const domain = cleanHost.replace(/^www\./, '')
  
  // Try custom domain first
  const byDomain = await prisma.company.findUnique({
    where: { customDomain: domain },
  })
  
  if (byDomain) return byDomain
  
  // Try subdomain (slug)
  const slug = domain.split('.')[0]
  
  const bySlug = await prisma.company.findUnique({
    where: { slug },
  })
  
  return bySlug
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
