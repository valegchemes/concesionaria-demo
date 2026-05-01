'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Car, Handshake, DollarSign, Calendar, Clock, CreditCard, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DealDetail {
  id: string
  status: string
  finalPrice: number
  finalPriceCurrency: string
  depositAmount: number | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  lead: {
    id: string
    name: string
    phone: string
  }
  unit: {
    id: string
    title: string
    type: string
  }
  seller: {
    id: string
    name: string
    email: string
  }
  payments: any[]
  closingCosts: any[]
  tradeIn: any | null
}

const statusColors: Record<string, string> = {
  NEGOTIATION: 'bg-blue-100 text-blue-800',
  RESERVED: 'bg-pink-100 text-pink-800',
  APPROVED: 'bg-purple-100 text-purple-800',
  IN_PAYMENT: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  NEGOTIATION: 'Negociación',
  RESERVED: 'Reservado',
  APPROVED: 'Aprobado',
  IN_PAYMENT: 'En Pago',
  DELIVERED: 'Entregado',
  CANCELED: 'Cancelado',
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  
  const getFontSizeClass = (text: string) => {
    const len = text.length
    if (len > 22) return 'text-sm'
    if (len > 18) return 'text-base'
    if (len > 14) return 'text-lg'
    if (len > 10) return 'text-xl'
    return 'text-2xl'
  }
  
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeal()
  }, [id])

  async function fetchDeal() {
    try {
      const res = await fetch(`/api/deals/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDeal(data.data)
      } else {
        router.push('/app/deals')
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
      router.push('/app/deals')
    } finally {
      setLoading(false)
    }
  }

  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function updateStatus(newStatus: string) {
    if (!deal) return
    if (newStatus === 'DELIVERED' && !confirm('¿Marcar como Entregado? Esto cerrará la operación y marcará la unidad como Vendida.')) return
    if (newStatus === 'CANCELED' && !confirm('¿Seguro que deseas cancelar esta operación?')) return

    try {
      setUpdatingStatus(true)
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (res.ok) {
        alert('Estado actualizado correctamente')
        fetchDeal() // refrescar para obtener los datos actualizados
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || 'No se pudo actualizar'}`)
      }
    } catch (e) {
      alert('Error de conexión')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!deal) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Operación
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  disabled={updatingStatus || deal.status === 'CANCELED' || deal.status === 'DELIVERED'}
                  value={deal.status}
                  onValueChange={updateStatus}
                >
                  <SelectTrigger className={`h-8 border-none font-bold uppercase tracking-wider text-xs px-3 rounded-full ${statusColors[deal.status] || 'bg-gray-100 text-gray-800'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs uppercase font-semibold">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Iniciada el {formatDate(deal.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Info) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente (Lead)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">{deal.lead.name}</p>
                    <p className="text-slate-500 text-sm">{deal.lead.phone}</p>
                  </div>
                  <Link href={`/app/leads/${deal.lead.id}`}>
                    <Button variant="outline" size="sm">Ver Ficha</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Unit Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehículo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">{deal.unit.title}</p>
                    <p className="text-slate-500 text-sm capitalize">{deal.unit.type.toLowerCase()}</p>
                  </div>
                  <Link href={`/app/units/${deal.unit.id}`}>
                    <Button variant="outline" size="sm">Ver Unidad</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview */}
          <Card className="border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Precio Final Pactado</p>
                  <p className={`font-black text-slate-900 break-words ${getFontSizeClass(formatPrice(deal.finalPrice, deal.finalPriceCurrency))}`}>
                    {deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}{formatPrice(deal.finalPrice, deal.finalPriceCurrency)}
                  </p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Seña / Anticipo</p>
                  <p className={`font-bold text-blue-600 break-words ${deal.depositAmount ? getFontSizeClass(formatPrice(deal.depositAmount, deal.finalPriceCurrency)) : 'text-2xl'}`}>
                    {deal.depositAmount 
                      ? `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.depositAmount, deal.finalPriceCurrency)}` 
                      : '-'}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Saldo Pendiente</p>
                  <p className={`font-bold text-slate-700 break-words ${getFontSizeClass(formatPrice(deal.finalPrice - (deal.depositAmount || 0), deal.finalPriceCurrency))}`}>
                    {deal.depositAmount 
                      ? `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.finalPrice - deal.depositAmount, deal.finalPriceCurrency)}` 
                      : `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.finalPrice, deal.finalPriceCurrency)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {deal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-500">Notas de la Operación</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{deal.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Vendedor Asignado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{deal.seller.name}</p>
              <p className="text-sm text-slate-500">{deal.seller.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Línea de Tiempo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                </div>
                <div>
                  <p className="text-sm font-medium">Operación Iniciada</p>
                  <p className="text-xs text-slate-500">{formatDate(deal.createdAt)}</p>
                </div>
              </div>
              {deal.closedAt && (
                <div className="flex gap-3">
                  <div className="mt-1">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Operación Cerrada</p>
                    <p className="text-xs text-slate-500">{formatDate(deal.closedAt)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
