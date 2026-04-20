import { prisma } from '@/lib/prisma'
import { resolveCompanyFromHost } from '@/lib/tenant'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

async function getCatalogData(companyId: string) {
  const units = await prisma.unit.findMany({
    where: {
      companyId,
      status: 'AVAILABLE',
    },
    include: {
      photos: {
        orderBy: { order: 'asc' },
        take: 1,
      },
      attributes: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { units }
}

async function getCompany() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  if (host.includes('localhost')) {
    const company = await prisma.company.findUnique({
      where: { slug: 'demo' },
    })
    return company
  }
  
  return resolveCompanyFromHost(host)
}

export default async function CatalogPage() {
  const company = await getCompany()
  
  if (!company) {
    notFound()
  }

  const { units } = await getCatalogData(company.id)

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Nuestro Stock</h2>
        <p className="text-gray-600">
          {units.length} unidades disponibles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit: any) => (
          <Link
            key={unit.id}
            href={`/u/${unit.id}`}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="aspect-video bg-gray-200 relative">
              {unit.photos[0] ? (
                <Image
                  src={unit.photos[0].url}
                  alt={unit.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Sin foto
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-1">{unit.title}</h3>
              <p className="text-gray-600 text-sm mb-2">{unit.type} • {unit.location}</p>
              
              <div className="flex items-baseline gap-2">
                {unit.priceArs && (
                  <span className="text-xl font-bold text-blue-600">
                    {formatPrice(Number(unit.priceArs), 'ARS')}
                  </span>
                )}
              </div>
              {unit.priceUsd && (
                <span className="text-sm text-gray-500">
                  USD {unit.priceUsd.toString()}
                </span>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {unit.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
