'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Car, Bike, Anchor, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface Unit {
  id: string
  type: 'CAR' | 'MOTORCYCLE' | 'BOAT'
  title: string
  status: string
  priceArs: string | number | null
  priceUsd: string | number | null
  location: string | null
  tags: string[]
  createdAt: string
  photos: Array<{ url: string; order: number }>
  _count?: { interestedLeads: number; deals: number }
}

const typeIcons = {
  CAR: Car,
  MOTORCYCLE: Bike,
  BOAT: Anchor,
}

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  IN_PREP: 'bg-yellow-100 text-yellow-800',
  RESERVED: 'bg-orange-100 text-orange-800',
  SOLD: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Disponible',
  IN_PREP: 'En preparación',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
}

function formatPriceSimple(value: string | number | null, currency: string): string {
  if (value === null || value === undefined) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDateSimple(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-AR')
  } catch {
    return ''
  }
}

export default function UnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activePhoto, setActivePhoto] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchUnits()
  }, [])

  async function fetchUnits() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/units', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      const list = Array.isArray(data?.data) ? data.data : []
      setUnits(list)
    } catch (err) {
      console.error('Error fetching units:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar las unidades')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUnit(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta unidad?')) return
    try {
      const res = await fetch(`/api/units/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
        setUnits(prev => prev.filter(u => u.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = data?.error || data?.message || `Error ${res.status}`
        alert(`No se pudo eliminar la unidad: ${msg}`)
      }
    } catch (err) {
      alert('Error de conexión al intentar eliminar')
    }
  }

  const filteredUnits = units.filter(unit => {
    const q = search.toLowerCase()
    return (
      unit.title.toLowerCase().includes(q) ||
      (unit.location?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario de Unidades</h1>
        <Link href="/app/units/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Unidad
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar unidades..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-500 font-medium">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchUnits}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredUnits.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Car className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">No hay unidades cargadas</p>
            <p className="text-sm mt-1">
              {search ? 'No hay resultados para tu búsqueda.' : 'Agrega tu primera unidad haciendo click en "Nueva Unidad".'}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredUnits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => {
            const TypeIcon = typeIcons[unit.type] ?? Car
            const photoUrl = unit.photos?.[0]?.url ?? null

            return (
              <Card key={unit.id} className="overflow-hidden group">
                {/* Imagen principal — clickeable */}
                <Link href={`/app/units/${unit.id}`}>
                  <div className="aspect-video bg-gray-100 relative cursor-pointer overflow-hidden">
                    {unit.photos && unit.photos.length > 0 ? (
                      <img
                        src={unit.photos[activePhoto[unit.id] ?? 0]?.url ?? unit.photos[0].url}
                        alt={unit.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <TypeIcon className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[unit.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[unit.status] ?? unit.status}
                      </span>
                    </div>
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                  </div>
                </Link>

                {/* Galería de miniaturas */}
                {unit.photos && unit.photos.length > 1 && (
                  <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto scrollbar-hide">
                    {unit.photos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhoto(prev => ({ ...prev, [unit.id]: idx }))}
                        className={`flex-shrink-0 w-12 h-9 rounded overflow-hidden border-2 transition-all ${
                          (activePhoto[unit.id] ?? 0) === idx
                            ? 'border-blue-500 opacity-100'
                            : 'border-transparent opacity-60 hover:opacity-90'
                        }`}
                      >
                        <img src={photo.url} alt={`foto ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg truncate">{unit.title}</h3>
                      <p className="text-sm text-gray-500">{unit.location || 'Sin ubicación'}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Link href={`/app/units/${unit.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => deleteUnit(unit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    {unit.priceArs && (
                      <span className="text-lg font-bold text-blue-600">
                        {formatPriceSimple(unit.priceArs, 'ARS')}
                      </span>
                    )}
                    {unit.priceUsd && (
                      <span className="text-sm text-gray-500">
                        {formatPriceSimple(unit.priceUsd, 'USD')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                    <span>{formatDateSimple(unit.createdAt)}</span>
                    {(unit._count?.interestedLeads ?? 0) > 0 && (
                      <span className="text-blue-600">
                        {unit._count!.interestedLeads} leads interesados
                      </span>
                    )}
                  </div>

                  {(unit.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(unit.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {(unit.tags?.length ?? 0) > 3 && (
                        <span className="text-xs text-gray-500">+{(unit.tags?.length ?? 0) - 3}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
