'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import {
  ArrowLeft, ExternalLink, Users, Plus, Trash2, TrendingUp,
  ShoppingCart, Wrench, DollarSign, AlertCircle
} from 'lucide-react'

interface CostItem {
  id: string
  concept: string
  amountArs: number | null
  amountUsd: number | null
  date: string
}

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
  costItems: CostItem[]
  interestedLeads: {
    id: string
    name: string
    status: string
    phone: string
    assignedTo: { name: string } | null
  }[]
}

const unitTypes: Record<string, string> = { CAR: 'Auto', MOTORCYCLE: 'Moto', BOAT: 'Lancha' }
const statuses: Record<string, string> = {
  AVAILABLE: 'Disponible', IN_PREP: 'En preparación', RESERVED: 'Reservado', SOLD: 'Vendido',
}

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Unit>>({})

  // Cost form
  const [showCostForm, setShowCostForm] = useState(false)
  const [costForm, setCostForm] = useState({ concept: '', amountArs: '', amountUsd: '' })
  const [costSaving, setCostSaving] = useState(false)
  const [costError, setCostError] = useState('')

  useEffect(() => { fetchUnit() }, [id])

  async function fetchUnit() {
    try {
      const res = await fetch(`/api/units/${id}`)
      if (res.ok) {
        const json = await res.json()
        setUnit(json.data)
        setFormData(json.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceArs: formData.priceArs != null ? Number(formData.priceArs) : null,
          priceUsd: formData.priceUsd != null ? Number(formData.priceUsd) : null,
          acquisitionCostArs: formData.acquisitionCostArs != null ? Number(formData.acquisitionCostArs) : null,
          acquisitionCostUsd: formData.acquisitionCostUsd != null ? Number(formData.acquisitionCostUsd) : null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUnit(updated.data)
        setIsEditing(false)
      } else {
        const errorText = await res.text()
        alert(`Error al guardar: ${res.status} - ${errorText}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function addCostItem() {
    setCostError('')
    if (!costForm.concept.trim()) { setCostError('Ingresá un concepto'); return }
    if (!costForm.amountArs && !costForm.amountUsd) { setCostError('Ingresá al menos un monto'); return }
    setCostSaving(true)
    try {
      const res = await fetch(`/api/units/${id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: costForm.concept,
          amountArs: costForm.amountArs ? Number(costForm.amountArs) : null,
          amountUsd: costForm.amountUsd ? Number(costForm.amountUsd) : null,
        }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setUnit(prev => prev ? { ...prev, costItems: [newItem.data, ...(prev.costItems || [])] } : prev)
        setCostForm({ concept: '', amountArs: '', amountUsd: '' })
        setShowCostForm(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCostSaving(false)
    }
  }

  async function deleteCostItem(costId: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      const res = await fetch(`/api/units/${id}/costs/${costId}`, { method: 'DELETE' })
      if (res.ok) {
        setUnit(prev => prev ? { ...prev, costItems: prev.costItems.filter(c => c.id !== costId) } : prev)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>
  if (!unit) return <div className="flex items-center justify-center h-64 text-gray-500">Unidad no encontrada</div>

  // Cost calculations
  const costItems = unit.costItems || []
  const acqCostArs = Number(unit.acquisitionCostArs) || 0
  const acqCostUsd = Number(unit.acquisitionCostUsd) || 0
  const totalCostArs = acqCostArs + costItems.reduce((s, c) => s + (Number(c.amountArs) || 0), 0)
  const totalCostUsd = acqCostUsd + costItems.reduce((s, c) => s + (Number(c.amountUsd) || 0), 0)
  const priceArs = Number(unit.priceArs) || 0
  const marginArs = unit.priceArs ? priceArs - totalCostArs : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app/units">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1">{unit.title}</h1>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{unitTypes[unit.type]}</span>
        <span className={`px-3 py-1 rounded-full text-sm ${unit.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
            unit.status === 'SOLD' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
          }`}>{statuses[unit.status]}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Photo */}
          <Card>
            <div className="aspect-video bg-gray-100 relative">
              {unit.photos?.[0] ? (
                <img src={unit.photos[0].url} alt={unit.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Sin foto</div>
              )}
            </div>
          </Card>

          {/* Prices */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" />Precios de Venta</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {unit.priceArs ? (
                <div>
                  <p className="text-xs text-gray-500">Precio ARS</p>
                  <p className="text-2xl font-bold text-blue-600">{formatPrice(unit.priceArs, 'ARS')}</p>
                </div>
              ) : <p className="text-sm text-gray-400">Sin precio ARS</p>}
              {unit.priceUsd && (
                <div>
                  <p className="text-xs text-gray-500">Precio USD</p>
                  <p className="text-xl font-semibold">${unit.priceUsd.toLocaleString()}</p>
                </div>
              )}
              {marginArs !== null && (
                <div className={`mt-3 p-3 rounded-lg ${marginArs >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-xs font-medium text-gray-600">Margen estimado (ARS)</p>
                  <p className={`text-lg font-bold ${marginArs >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {marginArs >= 0 ? '+' : ''}{formatPrice(marginArs, 'ARS')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardContent className="p-4">
              <Link href={`/u/${unit.id}`} target="_blank">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />Ver en catálogo público
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit form / Details */}
          {isEditing ? (
            <form onSubmit={onSubmit}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Editar Unidad</CardTitle>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input value={formData.title || ''} onChange={e => updateField('title', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Precio ARS</Label>
                      <Input type="number" value={formData.priceArs || ''} onChange={e => updateField('priceArs', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio USD</Label>
                      <Input type="number" value={formData.priceUsd || ''} onChange={e => updateField('priceUsd', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Costo de Compra ARS</Label>
                      <Input type="number" placeholder="0" value={formData.acquisitionCostArs || ''} onChange={e => updateField('acquisitionCostArs', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Costo de Compra USD</Label>
                      <Input type="number" placeholder="0" value={formData.acquisitionCostUsd || ''} onChange={e => updateField('acquisitionCostUsd', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <textarea value={formData.description || ''} onChange={e => updateField('description', e.target.value)} className="w-full min-h-[80px] px-3 py-2 rounded-md border text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input value={formData.location || ''} onChange={e => updateField('location', e.target.value)} />
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
                  <div><span className="text-gray-500">Tipo:</span><p className="font-medium">{unitTypes[unit.type]}</p></div>
                  <div><span className="text-gray-500">Estado:</span><p className="font-medium">{statuses[unit.status]}</p></div>
                  {unit.vin && <div><span className="text-gray-500">VIN:</span><p className="font-medium font-mono">{unit.vin}</p></div>}
                  {unit.domain && <div><span className="text-gray-500">Patente:</span><p className="font-medium">{unit.domain}</p></div>}
                  {unit.engineNumber && <div><span className="text-gray-500">N° Motor:</span><p className="font-medium">{unit.engineNumber}</p></div>}
                  {unit.frameNumber && <div><span className="text-gray-500">N° Cuadro:</span><p className="font-medium">{unit.frameNumber}</p></div>}
                </div>
                {unit.description && <div><span className="text-gray-500 text-sm">Descripción:</span><p className="mt-1 text-sm">{unit.description}</p></div>}
                {unit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unit.tags.map(tag => <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{tag}</span>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===================== COST SECTION ===================== */}
          <Card className="border-2 border-orange-100">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <TrendingUp className="h-5 w-5" />
                  Costo Total de la Unidad
                </CardTitle>
                <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => { setShowCostForm(!showCostForm); setCostError('') }}>
                  <Plus className="h-4 w-4 mr-1" />Agregar Gasto
                </Button>
              </div>

              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Costo de adquisición ARS</p>
                  <p className="text-lg font-bold text-gray-800">{formatPrice(acqCostArs, 'ARS')}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Wrench className="h-3 w-3" />Gastos adicionales ARS</p>
                  <p className="text-lg font-bold text-gray-800">{formatPrice(costItems.reduce((s, c) => s + (Number(c.amountArs) || 0), 0), 'ARS')}</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-orange-100 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-orange-900">Costo Total ARS</span>
                <span className="text-2xl font-black text-orange-800">{formatPrice(totalCostArs, 'ARS')}</span>
              </div>
              {totalCostUsd > 0 && (
                <div className="mt-2 p-2 bg-amber-100 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-900">Costo Total USD</span>
                  <span className="text-lg font-bold text-amber-800">${totalCostUsd.toLocaleString()}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Add cost form */}
              {showCostForm && (
                <div className="p-4 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50 space-y-3">
                  <p className="text-sm font-semibold text-orange-800">Nuevo Gasto / Inversión</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Concepto *</Label>
                    <Input
                      placeholder="Ej: Cambio de cubiertas, pintura, revisión mecánica..."
                      value={costForm.concept}
                      onChange={e => setCostForm(p => ({ ...p, concept: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Monto ARS</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={costForm.amountArs}
                        onChange={e => setCostForm(p => ({ ...p, amountArs: e.target.value }))}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Monto USD</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={costForm.amountUsd}
                        onChange={e => setCostForm(p => ({ ...p, amountUsd: e.target.value }))}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  {costError && (
                    <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{costError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addCostItem} disabled={costSaving} className="bg-orange-600 hover:bg-orange-700 text-white">
                      {costSaving ? 'Guardando...' : 'Agregar Gasto'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowCostForm(false); setCostError('') }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Acquisition cost row */}
              {(unit.acquisitionCostArs || unit.acquisitionCostUsd) && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded"><ShoppingCart className="h-4 w-4 text-blue-600" /></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Costo de Adquisición</p>
                      <p className="text-xs text-gray-500">Precio de compra de la unidad</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {unit.acquisitionCostArs && <p className="font-bold text-blue-700">{formatPrice(unit.acquisitionCostArs, 'ARS')}</p>}
                    {unit.acquisitionCostUsd && <p className="text-sm text-blue-600">${unit.acquisitionCostUsd.toLocaleString()} USD</p>}
                  </div>
                </div>
              )}

              {/* Cost items list */}
              {costItems.length === 0 && !unit.acquisitionCostArs ? (
                <div className="text-center py-8 text-gray-400">
                  <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay gastos registrados aún</p>
                  <p className="text-xs mt-1">Agregá el costo de compra (editando la unidad) y los gastos adicionales</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {costItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg group">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-100 rounded"><Wrench className="h-4 w-4 text-orange-600" /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.concept}</p>
                          <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('es-AR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {item.amountArs && <p className="font-bold text-gray-800">{formatPrice(item.amountArs, 'ARS')}</p>}
                          {item.amountUsd && <p className="text-sm text-gray-600">${item.amountUsd.toLocaleString()} USD</p>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteCostItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interested Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Leads Interesados ({(unit.interestedLeads || []).length})
              </CardTitle>
              <Link href={`/app/leads/new?unitId=${unit.id}`}>
                <Button size="sm">Agregar Lead</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {(unit.interestedLeads || []).length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No hay leads interesados en esta unidad</p>
              ) : (
                <div className="space-y-3">
                  {(unit.interestedLeads || []).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{lead.name}</p>
                        <p className="text-xs text-gray-500">{lead.phone}</p>
                        {lead.assignedTo && <p className="text-xs text-gray-400">Asignado: {lead.assignedTo.name}</p>}
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
