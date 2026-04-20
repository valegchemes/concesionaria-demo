'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { ArrowLeft, ExternalLink, Users } from 'lucide-react'

interface Unit {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  location: string | null
  tags: string[]
  priceArs: number | null
  priceUsd: number | null
  vin: string | null
  domain: string | null
  engineNumber: string | null
  frameNumber: string | null
  hin: string | null
  registrationNumber: string | null
  acquisitionCostArs: number | null
  acquisitionCostUsd: number | null
  acquisitionType: string
  photos: { id: string; url: string }[]
  attributes: { id: string; key: string; value: string }[]
  interestedLeads: {
    id: string
    name: string
    status: string
    phone: string
    assignedTo: { name: string } | null
  }[]
}

const unitTypes: Record<string, string> = {
  CAR: 'Auto',
  MOTORCYCLE: 'Moto',
  BOAT: 'Lancha',
}

const statuses: Record<string, string> = {
  AVAILABLE: 'Disponible',
  IN_PREP: 'En preparación',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
}

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  // Unwrap promise for Next.js 15 params
  const { id } = use(params)
  
  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Unit>>({})

  useEffect(() => {
    fetchUnit()
  }, [id])

  async function fetchUnit() {
    try {
      const res = await fetch(`/api/units/${id}`)
      if (res.ok) {
        const data = await res.json()
        setUnit(data)
        setFormData(data)
      }
    } catch (error) {
      console.error('Error fetching unit:', error)
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceArs: formData.priceArs ? Number(formData.priceArs) : null,
          priceUsd: formData.priceUsd ? Number(formData.priceUsd) : null,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setUnit(updated)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error updating unit:', error)
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) return <div>Cargando...</div>
  if (!unit) return <div>Unidad no encontrada</div>

  const publicUrl = `/u/${unit.id}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/units">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{unit.title}</h1>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
          {unitTypes[unit.type]}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm ${
          unit.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
          unit.status === 'SOLD' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {statuses[unit.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Photos & Quick Info */}
        <div className="space-y-6">
          <Card>
            <div className="aspect-video bg-gray-100 relative">
              {unit.photos[0] ? (
                <img
                  src={unit.photos[0].url}
                  alt={unit.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Sin foto
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {unit.priceArs && (
                <div>
                  <Label>Precio ARS</Label>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPrice(unit.priceArs, 'ARS')}
                  </div>
                </div>
              )}
              {unit.priceUsd && (
                <div>
                  <Label>Precio USD</Label>
                  <div className="text-xl font-semibold">
                    ${unit.priceUsd.toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={publicUrl} target="_blank">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en catálogo público
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Details & Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <form onSubmit={onSubmit}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Editar Unidad</CardTitle>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={formData.title || ''}
                      onChange={(e) => updateField('title', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Precio ARS</Label>
                      <Input
                        type="number"
                        value={formData.priceArs || ''}
                        onChange={(e) => updateField('priceArs', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio USD</Label>
                      <Input
                        type="number"
                        value={formData.priceUsd || ''}
                        onChange={(e) => updateField('priceUsd', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      className="w-full min-h-[100px] px-3 py-2 rounded-md border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input
                      value={formData.location || ''}
                      onChange={(e) => updateField('location', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </form>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Detalles</CardTitle>
                <Button onClick={() => setIsEditing(true)}>Editar</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Tipo:</span>
                    <p className="font-medium">{unitTypes[unit.type]}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Estado:</span>
                    <p className="font-medium">{statuses[unit.status]}</p>
                  </div>
                  {unit.vin && (
                    <div>
                      <span className="text-gray-500">VIN:</span>
                      <p className="font-medium">{unit.vin}</p>
                    </div>
                  )}
                  {unit.domain && (
                    <div>
                      <span className="text-gray-500">Patente:</span>
                      <p className="font-medium">{unit.domain}</p>
                    </div>
                  )}
                  {unit.engineNumber && (
                    <div>
                      <span className="text-gray-500">N° Motor:</span>
                      <p className="font-medium">{unit.engineNumber}</p>
                    </div>
                  )}
                  {unit.frameNumber && (
                    <div>
                      <span className="text-gray-500">N° Cuadro:</span>
                      <p className="font-medium">{unit.frameNumber}</p>
                    </div>
                  )}
                  {unit.hin && (
                    <div>
                      <span className="text-gray-500">HIN:</span>
                      <p className="font-medium">{unit.hin}</p>
                    </div>
                  )}
                </div>

                {unit.description && (
                  <div>
                    <span className="text-gray-500">Descripción:</span>
                    <p className="mt-1">{unit.description}</p>
                  </div>
                )}

                {unit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unit.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interested Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Leads Interesados ({unit.interestedLeads.length})
              </CardTitle>
              <Link href={`/app/leads/new?unitId=${unit.id}`}>
                <Button size="sm">Agregar Lead</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {unit.interestedLeads.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No hay leads interesados en esta unidad
                </p>
              ) : (
                <div className="space-y-3">
                  {unit.interestedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.phone}</p>
                        {lead.assignedTo && (
                          <p className="text-xs text-gray-400">
                            Asignado: {lead.assignedTo.name}
                          </p>
                        )}
                      </div>
                      <Link href={`/app/leads/${lead.id}`}>
                        <Button size="sm" variant="outline">Ver</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
