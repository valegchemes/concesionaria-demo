'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import { Handshake, Plus, Search, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const statusConfig: Record<string, { label: string; classes: string }> = {
  NEGOTIATION: { label: 'Negociación', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  RESERVED:    { label: 'Reservado',   classes: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300' },
  APPROVED:    { label: 'Aprobado',    classes: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  IN_PAYMENT:  { label: 'En Pago',    classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  DELIVERED:   { label: 'Entregado',  classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CANCELED:    { label: 'Cancelado',  classes: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400' },
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    try {
      const res = await fetch('/api/deals', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
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
      if (res.ok) {
        setDeals(prev => prev.filter(d => d.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`No se pudo eliminar: ${data?.error || data?.message || res.status}`)
      }
    } catch {
      alert('Error de conexión al intentar eliminar')
    }
  }

  const filteredDeals = Array.isArray(deals)
    ? deals.filter(d =>
        d.lead.name.toLowerCase().includes(search.toLowerCase()) ||
        d.unit.title.toLowerCase().includes(search.toLowerCase())
      )
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Operaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredDeals.length} operación{filteredDeals.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Link href="/app/deals/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva Operación
          </Button>
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente o vehículo…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredDeals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Handshake className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No se encontraron operaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Cabecera de columnas */}
          <div className="hidden md:grid grid-cols-[1fr_1.4fr_1.4fr_0.8fr_auto_auto] gap-x-4 px-4 py-2.5 bg-muted/50 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Estado / Fecha</span>
            <span>Cliente</span>
            <span>Unidad</span>
            <span>Vendedor</span>
            <span className="text-right">Precio Final</span>
            <span className="w-8" />
          </div>

          {/* Filas */}
          <div className="divide-y divide-border">
            {filteredDeals.map((deal) => {
              const status = statusConfig[deal.status] ?? { label: deal.status, classes: 'bg-slate-100 text-slate-600' }

              return (
                <div
                  key={deal.id}
                  className="group grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1.4fr_0.8fr_auto_auto] gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-muted/30 cursor-pointer transition-colors duration-100 items-center"
                  onClick={() => router.push(`/app/deals/${deal.id}`)}
                >
                  {/* Estado + Fecha */}
                  <div className="flex flex-wrap md:flex-col gap-1.5 md:gap-1">
                    <span className={cn('badge text-[11px]', status.classes)}>
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(deal.createdAt)}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{deal.lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{deal.lead.phone}</p>
                  </div>

                  {/* Unidad */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{deal.unit.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{deal.unit.type.toLowerCase()}</p>
                  </div>

                  {/* Vendedor */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{deal.seller.name}</p>
                  </div>

                  {/* Precio */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
                      {deal.finalPriceCurrency} {formatPrice(deal.finalPrice, '')}
                    </p>
                  </div>

                  {/* Eliminar */}
                  <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteDeal(deal.id)}
                      title="Eliminar operación"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
