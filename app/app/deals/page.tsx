'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import { Handshake, Plus, Search, Loader2, Trash2, TrendingUp, Clock, CheckCircle, XCircle, DollarSign, FileDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/export'

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

const statusConfig: Record<string, { label: string; classes: string; dot: string; icon: any }> = {
  NEGOTIATION: { label: 'Negociación', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',     dot: 'bg-blue-400',    icon: TrendingUp },
  RESERVED:    { label: 'Reservado',   classes: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300',     dot: 'bg-pink-400',    icon: Clock },
  APPROVED:    { label: 'Aprobado',    classes: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-400', icon: CheckCircle },
  IN_PAYMENT:  { label: 'En Pago',     classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', dot: 'bg-amber-400',   icon: DollarSign },
  DELIVERED:   { label: 'Entregado',   classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400', icon: CheckCircle },
  CANCELED:    { label: 'Cancelado',   classes: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400', dot: 'bg-slate-300',  icon: XCircle },
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

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
    ? deals.filter(d => {
        const matchSearch =
          d.lead.name.toLowerCase().includes(search.toLowerCase()) ||
          d.unit.title.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'ALL' || d.status === statusFilter
        return matchSearch && matchStatus
      })
    : []

  function handleExport() {
    const rows = filteredDeals.map(d => ({
      'Cliente': d.lead.name,
      'Teléfono': d.lead.phone,
      'Vehículo': d.unit.title,
      'Precio': d.finalPrice,
      'Moneda': d.finalPriceCurrency,
      'Estado': statusConfig[d.status]?.label ?? d.status,
      'Vendedor': d.seller.name,
      'Fecha': formatDate(d.createdAt),
    }))
    exportToExcel(rows, `Operaciones_${new Date().toISOString().split('T')[0]}`, 'Operaciones')
  }

  const totalRevenue = deals
    .filter(d => d.status === 'DELIVERED')
    .reduce((sum, d) => sum + (d.finalPriceCurrency === 'ARS' ? d.finalPrice : 0), 0)

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
          <h1 className="text-xl font-bold text-foreground">Operaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {deals.filter(d => d.status === 'DELIVERED').length}
            </span> entregadas · {filteredDeals.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
          <Link href="/app/deals/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva Operación
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 w-fit">
        {['ALL', 'NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              statusFilter === s ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}>
            {s === 'ALL' ? 'Todos' : statusConfig[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente o vehículo…"
          className="pl-9 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredDeals.length === 0 ? (
        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/30">
          <CardContent className="py-16 text-center">
            <Handshake className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No se encontraron operaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
          {/* Cabecera de columnas */}
          <div className="hidden md:grid grid-cols-[1fr_1.4fr_1.4fr_0.8fr_auto_auto] gap-x-4 px-5 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Estado / Fecha</span>
            <span>Cliente</span>
            <span>Unidad</span>
            <span>Vendedor</span>
            <span className="text-right">Precio Final</span>
            <span className="w-8" />
          </div>

          {/* Filas */}
          <div className="divide-y divide-border/50">
            {filteredDeals.map((deal, idx) => {
              const status = statusConfig[deal.status] ?? { label: deal.status, classes: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', icon: Clock }
              const StatusIcon = status.icon
              const isDelivered = deal.status === 'DELIVERED'

              return (
                <div
                  key={deal.id}
                  className={cn(
                    'group grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1.4fr_0.8fr_auto_auto] gap-x-4 gap-y-2 px-5 py-4 cursor-pointer transition-colors duration-100 items-center',
                    idx % 2 !== 0 && 'bg-muted/15',
                    'hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                  )}
                  onClick={() => router.push(`/app/deals/${deal.id}`)}
                >
                  {/* Estado + Fecha */}
                  <div className="flex flex-wrap md:flex-col gap-1.5 md:gap-1">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', status.classes)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(deal.createdAt)}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{deal.lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{deal.lead.phone}</p>
                  </div>

                  {/* Unidad */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{deal.unit.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{deal.unit.type.toLowerCase()}</p>
                  </div>

                  {/* Vendedor */}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{deal.seller.name}</p>
                  </div>

                  {/* Precio — verde si entregado */}
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-bold tabular-nums whitespace-nowrap',
                      isDelivered ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                    )}>
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
