import { resolveCompanyFromHost } from '@/lib/tenant'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

interface PublicLayoutProps {
  children: React.ReactNode
}

async function getCompany() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  // For localhost development, use a default or query param
  if (host.includes('localhost')) {
    // In dev, we can use a cookie or default to 'demo'
    return { id: 'demo', slug: 'demo', name: 'Demo Concesionaria' }
  }
  
  return resolveCompanyFromHost(host)
}

export default async function PublicLayout({ children }: PublicLayoutProps) {
  const company = await getCompany()
  
  if (!company) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">{company.name}</h1>
          <a 
            href={`https://wa.me/?text=Hola, vi el catálogo de ${company.name}`}
            className="bg-green-500 text-white px-4 py-2 rounded-lg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contactar por WhatsApp
          </a>
        </div>
      </header>
      {children}
    </div>
  )
}
