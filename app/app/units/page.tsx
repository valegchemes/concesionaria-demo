'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import { Plus, Search, Car, Bike, Anchor, Edit, Trash2 } from 'lucide-react'

interface Unit {
  id: string
  type: 'CAR' | 'MOTORCYCLE' | 'BOAT'
  title: string
  status: string
  priceArs: number | null
  priceUsd: number | null
  location: string | null
  tags: string[]
  createdAt: string
  photos: { url: string }[]
  _count: { interestedLeads: number }
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

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchUnits()
  }, [])

  async function fetchUnits() {
    try {
      const res = await fetch('/api/units')
      if (res.ok) {
        const data = await res.json()
        setUnits(data)
      }
    } catch (error) {
      console.error('Error fetching units:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteUnit(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta unidad?')) return

    try {
      const res = await fetch(`/api/units/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUnits(units.filter(u => u.id !== id))
      }
    } catch (error) {
      console.error('Error deleting unit:', error)
    }
  }

  const filteredUnits = units.filter(unit =>
    unit.title.toLowerCase().includes(search.toLowerCase()) ||
    unit.location?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div>Cargando...</div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnits.map((unit) => {
          const TypeIcon = typeIcons[unit.type]
          return (
            <Card key={unit.id} className="overflow-hidden">
              <div className="aspect-video bg-gray-100 relative">
                {unit.photos[0] ? (
                  <img
                    src={unit.photos[0].url}
                    alt={unit.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <TypeIcon className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[unit.status]}`}>
                    {statusLabels[unit.status]}
                  </span>
                </div>
              </div>
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
                      {formatPrice(unit.priceArs, 'ARS')}
                    </span>
                  )}
                  {unit.priceUsd && (
                    <span className="text-sm text-gray-500">
                      USD {unit.priceUsd}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                  <span>{formatDate(unit.createdAt)}</span>
                  {unit._count.interestedLeads > 0 && (
                    <span className="text-blue-600">
                      {unit._count.interestedLeads} leads interesados
                    </span>
                  )}
                </div>

                {unit.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {unit.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {unit.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{unit.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
