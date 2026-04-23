'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft, Save } from 'lucide-react'

interface Lead {
  id: string
  name: string
}

interface Unit {
  id: string
  title: string
  priceArs?: number
  priceUsd?: number
}

interface User {
  id: string
  name: string
}

const statusOptions = [
  { value: 'NEGOTIATION', label: 'Negociación' },
  { value: 'RESERVED', label: 'Reservado (Señado)' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'IN_PAYMENT', label: 'En proceso de pago' },
  { value: 'DELIVERED', label: 'Entregado (Venta cerrada)' },
]

export default function NewDealPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const [leads, setLeads] = useState<Lead[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [sellers, setSellers] = useState<User[]>([])

  const [formData, setFormData] = useState({
    leadId: '',
    unitId: '',
    sellerId: '',
    finalPrice: '',
    finalPriceCurrency: 'ARS',
    status: 'NEGOTIATION',
    depositAmount: '',
    notes: '',
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [leadsRes, unitsRes, sellersRes] = await Promise.all([
          fetch('/api/leads', { cache: 'no-store' }),
          fetch('/api/units', { cache: 'no-store' }),
          fetch('/api/users', { cache: 'no-store' }),
        ])

        if (leadsRes.ok) {
          const data = await leadsRes.json()
          setLeads(data.data || [])
        }
        if (unitsRes.ok) {
          const data = await unitsRes.json()
          setUnits(data.data || [])
        }
        if (sellersRes.ok) {
          const data = await sellersRes.json()
          // Users API still returns an array directly
          setSellers(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Error cargando datos para operacion:', err)
      } finally {
        setFetching(false)
      }
    }
    loadData()
  }, [])

  // Pre-seleccionar vendedor actual una sola vez al montar
  useEffect(() => {
    if (session?.user?.id) {
      setFormData(prev => ({ ...prev, sellerId: session.user.id }))
    }
  }, [session?.user?.id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        finalPrice: parseFloat(formData.finalPrice),
        depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : undefined,
      }

      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/app/deals')
        router.refresh()
      } else {
        const error = await res.json()
        alert('Error: ' + JSON.stringify(error))
      }
    } catch (error) {
      console.error('Error creando operacion:', error)
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Si cambia la unidad, podríamos sugerir el precio (opcional)
    if (field === 'unitId') {
      const selectedUnit = units.find(u => u.id === value)
      if (selectedUnit) {
        // Por defecto usamos el precio en ARS si existe, o USD
        if (formData.finalPriceCurrency === 'ARS' && selectedUnit.priceArs) {
          setFormData(prev => ({ ...prev, unitId: value, finalPrice: selectedUnit.priceArs?.toString() || '' }))
        } else if (formData.finalPriceCurrency === 'USD' && selectedUnit.priceUsd) {
          setFormData(prev => ({ ...prev, unitId: value, finalPrice: selectedUnit.priceUsd?.toString() || '' }))
        }
      }
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Nueva Operación</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Partes Interesadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leadId">Cliente (Lead) *</Label>
                <select
                  id="leadId"
                  value={formData.leadId}
                  onChange={(e) => updateField('leadId', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {Array.isArray(leads) && leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitId">Unidad / Vehículo *</Label>
                <select
                  id="unitId"
                  value={formData.unitId}
                  onChange={(e) => updateField('unitId', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  required
                >
                  <option value="">Seleccionar vehículo...</option>
                  {Array.isArray(units) && units.map(u => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellerId">Vendedor Responsable *</Label>
                <select
                  id="sellerId"
                  value={formData.sellerId}
                  onChange={(e) => updateField('sellerId', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  required
                >
                  <option value="">Seleccionar vendedor...</option>
                  {Array.isArray(sellers) && sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalles Económicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-2">
                  <Label>Moneda</Label>
                  <select
                    value={formData.finalPriceCurrency}
                    onChange={(e) => updateField('finalPriceCurrency', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="finalPrice">Precio Final Pactado *</Label>
                  <Input
                    id="finalPrice"
                    type="number"
                    step="0.01"
                    value={formData.finalPrice}
                    onChange={(e) => updateField('finalPrice', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Seña / Depósito inicial (Opcional)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  value={formData.depositAmount}
                  onChange={(e) => updateField('depositAmount', e.target.value)}
                  placeholder="Monto de la reserva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado del Deal</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border bg-background"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notas de la Operación</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 rounded-md border bg-background"
              placeholder="Detalles sobre financiación, condiciones especiales, etc."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-12">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="px-8">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Crear Operación
          </Button>
        </div>
      </form>
    </div>
  )
}
