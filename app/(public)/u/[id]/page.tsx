import { prisma } from '@/lib/prisma'
import { resolveCompanyFromHost } from '@/lib/tenant'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice, generateWhatsAppLink, processTemplate } from '@/lib/utils'

async function getUnitData(unitId: string, companyId: string) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      companyId,
    },
    include: {
      photos: {
        orderBy: { order: 'asc' },
      },
      attributes: true,
      company: true,
    },
  })

  return unit
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

interface UnitPageProps {
  params: { id: string }
}

export default async function UnitDetailPage({ params }: UnitPageProps) {
  const company = await getCompany()
  
  if (!company) {
    notFound()
  }

  const unit = await getUnitData(params.id, company.id)

  if (!unit) {
    notFound()
  }

  // Generate WhatsApp link with template
  const defaultTemplate = 'Hola! Me interesa {unitTitle} que vi en el catálogo'
  const message = processTemplate(defaultTemplate, {
    unitTitle: unit.title,
    unitPriceARS: unit.priceArs?.toString() || '',
    unitPriceUSD: unit.priceUsd?.toString() || '',
    companyName: unit.company.name,
    publicUnitUrl: '', // Would be full URL
  })
  
  const whatsappLink = unit.company.whatsappCentral 
    ? generateWhatsAppLink(unit.company.whatsappCentral, message)
    : null

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Link 
        href="/"
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Photos */}
        <div className="space-y-4">
          <div className="aspect-video bg-gray-200 rounded-lg relative overflow-hidden">
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
          
          {unit.photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {unit.photos.slice(1, 5).map((photo: any) => (
                <div key={photo.id} className="aspect-square bg-gray-200 rounded relative overflow-hidden">
                  <Image
                    src={photo.url}
                    alt={unit.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{unit.title}</h1>
            <p className="text-gray-600">{unit.type} • {unit.location}</p>
          </div>

          <div className="flex items-baseline gap-4">
            {unit.priceArs && (
              <div>
                <span className="text-3xl font-bold text-blue-600">
                  {formatPrice(Number(unit.priceArs), 'ARS')}
                </span>
              </div>
            )}
            {unit.priceUsd && (
              <div>
                <span className="text-xl text-gray-500">
                  USD {unit.priceUsd.toString()}
                </span>
              </div>
            )}
          </div>

          {unit.description && (
            <div>
              <h3 className="font-semibold mb-2">Descripción</h3>
              <p className="text-gray-700">{unit.description}</p>
            </div>
          )}

          {unit.attributes.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Especificaciones</h3>
              <dl className="grid grid-cols-2 gap-2">
                {unit.attributes.map((attr: any) => (
                  <div key={attr.key} className="flex justify-between">
                    <dt className="text-gray-600 capitalize">{attr.key}:</dt>
                    <dd className="font-medium">{attr.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full bg-green-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Consultar por WhatsApp
            </a>
          )}

          <div className="flex flex-wrap gap-2">
            {unit.tags.map((tag: string) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
