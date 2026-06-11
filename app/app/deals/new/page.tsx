'use client'
import { toast } from 'sonner'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
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

interface CurrentUser extends User {
  role: string
}

const statusOptions = [
  { value: 'NEGOTIATION', label: 'Negociacion' },
  { value: 'RESERVED', label: 'Reservado (Senado)' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'IN_PAYMENT', label: 'En proceso de pago' },
  { value: 'DELIVERED', label: 'Entregado (Venta cerrada)' },
]

export default function NewDealPage() {
  const router = useRouter()
  const { user: me, isLoading: meLoading } = useCurrentUser()
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

  // Estado para toma de usado
  const [useTradeIn, setUseTradeIn] = useState(false)
  const [tradeInData, setTradeInData] = useState({
    description: '',
    type: 'CAR',
    expectedValue: '',
  })

  function formatWithDots(raw: string): string {
    const digits = raw.replace(/\D/g, '') // solo dígitos
    if (!digits) return ''
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(digits))
  }

  function parseFormatted(formatted: string): number | undefined {
    const clean = formatted.replace(/[^\d]/g, '')
    return clean ? Number(clean) : undefined
  }

  useEffect(() => {
    if (meLoading) return // Esperar a que useCurrentUser resuelva
    async function loadData() {
      try {
        const requests: Promise<Response>[] = [
          fetch('/api/leads?limit=100', { cache: 'no-store' }),
          fetch('/api/units?limit=100&status=AVAILABLE', { cache: 'no-store' }),
        ]

        if (me?.role === 'ADMIN' || me?.role === 'MANAGER') {
          requests.push(fetch('/api/users', { cache: 'no-store' }))
        }

        const [leadsRes, unitsRes, sellersRes] = await Promise.all(requests)

        if (leadsRes.ok) {
          const data = await leadsRes.json()
          setLeads(data.data || [])
        }

        if (unitsRes.ok) {
          const data = await unitsRes.json()
          setUnits(data.data || [])
        }

        if (sellersRes?.ok) {
          const data = await sellersRes.json()
          setSellers(Array.isArray(data) ? data : [])
        } else if (me) {
          setSellers([{ id: me.id, name: me.name }])
        }

        if (me?.id) {
          setFormData(prev => ({ ...prev, sellerId: me.id }))
        }
      } catch (err) {
        console.error('Error cargando datos para operacion:', err)
      } finally {
        setFetching(false)
      }
    }

    void loadData()
  }, [me, meLoading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: any = {
        ...formData,
        finalPrice: parseFormatted(formData.finalPrice) || 0,
        depositAmount: parseFormatted(formData.depositAmount),
      }

      if (useTradeIn && tradeInData.description) {
        payload.tradeIn = {
          description: tradeInData.description,
          type: tradeInData.type,
          expectedValue: parseFormatted(tradeInData.expectedValue) || 0,
        }
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
        toast.error('Error: ' + JSON.stringify(error))
      }
    } catch (error) {
      console.error('Error creando operacion:', error)
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))

    if (field === 'unitId') {
      const selectedUnit = units.find(u => u.id === value)
      if (selectedUnit) {
        if (formData.finalPriceCurrency === 'ARS' && selectedUnit.priceArs) {
          setFormData(prev => ({ ...prev, unitId: value, finalPrice: formatWithDots(selectedUnit.priceArs?.toString() || '') }))
        } else if (formData.finalPriceCurrency === 'USD' && selectedUnit.priceUsd) {
          setFormData(prev => ({ ...prev, unitId: value, finalPrice: formatWithDots(selectedUnit.priceUsd?.toString() || '') }))
        }
      }
    }
  }

  function updatePriceField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: formatWithDots(value) }))
  }

  if (fetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const canPickOtherSeller = me?.role === 'ADMIN' || me?.role === 'MANAGER'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Nueva Operacion</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                  className="h-10 w-full rounded-md border bg-background px-3"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {Array.isArray(leads) && leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitId">Unidad / Vehiculo *</Label>
                <select
                  id="unitId"
                  value={formData.unitId}
                  onChange={(e) => updateField('unitId', e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3"
                  required
                >
                  <option value="">Seleccionar vehiculo...</option>
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
                  className="h-10 w-full rounded-md border bg-background px-3"
                  required
                  disabled={!canPickOtherSeller}
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
              <CardTitle>Detalles Economicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-2">
                  <Label>Moneda</Label>
                  <select
                    value={formData.finalPriceCurrency}
                    onChange={(e) => updateField('finalPriceCurrency', e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="finalPrice">Precio Final Pactado *</Label>
                  <Input
                    id="finalPrice"
                    type="text"
                    inputMode="numeric"
                    value={formData.finalPrice}
                    onChange={(e) => updatePriceField('finalPrice', e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Sena / Deposito inicial (Opcional)</Label>
                <Input
                  id="depositAmount"
                  type="text"
                  inputMode="numeric"
                  value={formData.depositAmount}
                  onChange={(e) => updatePriceField('depositAmount', e.target.value)}
                  placeholder="Monto de la reserva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado del Deal</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3"
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Vehículo en Parte de Pago (Opcional)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Registrar unidad usada como trade-in</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useTradeIn"
                className="h-4 w-4 rounded border-gray-300"
                checked={useTradeIn}
                onChange={(e) => setUseTradeIn(e.target.checked)}
              />
              <Label htmlFor="useTradeIn" className="font-medium cursor-pointer">
                Recibir Usado
              </Label>
            </div>
          </CardHeader>
          
          {useTradeIn && (
            <CardContent className="space-y-4 pt-4 border-t mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-1 space-y-2">
                  <Label htmlFor="tradeInType">Tipo de Unidad</Label>
                  <select
                    id="tradeInType"
                    value={tradeInData.type}
                    onChange={(e) => setTradeInData({ ...tradeInData, type: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3"
                  >
                    <option value="CAR">Auto / Camioneta</option>
                    <option value="MOTORCYCLE">Moto</option>
                    <option value="BOAT">Náutica</option>
                  </select>
                </div>
                
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label htmlFor="tradeInDesc">Descripción del Vehículo *</Label>
                  <Input
                    id="tradeInDesc"
                    value={tradeInData.description}
                    onChange={(e) => setTradeInData({ ...tradeInData, description: e.target.value })}
                    placeholder="Ej: VW Golf 1.4 TSI Highline 2018"
                    required={useTradeIn}
                  />
                </div>
                
                <div className="col-span-1 md:col-span-3 space-y-2">
                  <Label htmlFor="tradeInValue">
                    Valor de Toma Pactado ({formData.finalPriceCurrency}) *
                  </Label>
                  <Input
                    id="tradeInValue"
                    type="text"
                    inputMode="numeric"
                    value={tradeInData.expectedValue}
                    onChange={(e) => setTradeInData({ ...tradeInData, expectedValue: formatWithDots(e.target.value) })}
                    placeholder="0"
                    required={useTradeIn}
                  />
                  <p className="text-xs text-muted-foreground">
                    El monto ingresado aquí será registrado como el costo de adquisición de la unidad entrante. 
                    No se deducirá automáticamente del precio final de la operación.
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas de la Operacion</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2"
              placeholder="Detalles sobre financiacion, condiciones especiales, etc."
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
            Crear Operacion
          </Button>
        </div>
      </form>
    </div>
  )
}
