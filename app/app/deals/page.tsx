'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatPrice, formatDate } from '@/lib/utils'
import { Handshake, Plus, Search, Loader2, User, Car, Calendar, Trash2 } from 'lucide-react'

interface Deal {
  id: string
  status: string
  finalPrice: number
  finalPriceCurrency: string
  createdAt: string
  lead: { name: string; phone: string }
  unit: { title: string; type: string }
  seller: { name: string }
}

const statusLabels: Record<string, string> = {
  NEGOTIATION: 'Negociación',
  RESERVED: 'Reservado',
  APPROVED: 'Aprobado',
  IN_PAYMENT: 'En Pago',
  DELIVERED: 'Entregado',
  CANCELED: 'Cancelado',
}

const statusColors: Record<string, string> = {
  NEGOTIATION: 'bg-blue-100 text-blue-800',
  RESERVED: 'bg-pink-100 text-pink-800',
  APPROVED: 'bg-indigo-100 text-indigo-800',
  IN_PAYMENT: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-800',
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchDeals()
  }, [])

  async function fetchDeals() {
    try {
      const res = await fetch('/api/deals', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        // The API returns a standardized object { success: true, data: [...], ... }
        setDeals(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching deals:', err)
    } finally {
      setLoading(false)
    }
  }

  async function deleteDeal(id: string) {
    if (!confirm('¿Eliminar esta operación? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
      if (res.ok) setDeals(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error('Error deleting deal:', err)
    }
  }

  const filteredDeals = Array.isArray(deals)
    ? deals.filter(deal =>
        deal.lead.name.toLowerCase().includes(search.toLowerCase()) ||
        deal.unit.title.toLowerCase().includes(search.toLowerCase())
      )
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Operaciones</h1>
        <Link href="/app/deals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Operación
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por cliente o vehículo..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {filteredDeals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Handshake className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No se encontraron operaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDeals.map((deal) => (
            <Card key={deal.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                       <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${statusColors[deal.status]}`}>
                        {statusLabels[deal.status]}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(deal.createdAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <User className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Cliente</p>
                          <p className="font-semibold">{deal.lead.name}</p>
                          <p className="text-xs text-gray-400">{deal.lead.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Car className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium font-bold">Unidad</p>
                          <p className="font-semibold">{deal.unit.title}</p>
                          <p className="text-xs text-gray-400 capitalize">{deal.unit.type.toLowerCase()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col justify-between items-end md:w-48 pt-4 md:pt-0 border-t md:border-t-0 md:border-l md:pl-6 border-slate-100">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Precio Final</p>
                      <p className="text-xl font-black text-slate-900 leading-tight">
                        {deal.finalPriceCurrency} {formatPrice(deal.finalPrice, '')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                        <User className="h-3 w-3" />
                        {deal.seller.name}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                        onClick={() => deleteDeal(deal.id)}
                        title="Eliminar operación"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
