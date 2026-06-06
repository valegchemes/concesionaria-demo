'use client'
import { toast } from 'sonner'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import { Handshake, Plus, Search, Loader2, Trash2, TrendingUp, Clock, CheckCircle, XCircle, DollarSign, FileDown, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/export'
import { KanbanBoard } from './KanbanBoard'
import { LayoutList, Columns3 } from 'lucide-react'
import { useRealtimeDeals } from '@/lib/hooks/use-realtime-deals'
import type { DealRealtimePayload } from '@/lib/hooks/use-realtime-deals'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

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
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [realtimeFlash, setRealtimeFlash] = useState<string | null>(null)

  const { user: currentUser } = useCurrentUser()
  const userRole = currentUser?.role ?? 'SELLER'
  const userId = currentUser?.id ?? ''
  const companyId = currentUser?.companyId ?? ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlStatus = params.get('status')
      if (urlStatus) setStatusFilter(urlStatus)
    }
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      const dealsRes = await fetch('/api/deals', { cache: 'no-store' })
      if (dealsRes.ok) {
        const data = await dealsRes.json()
        setDeals(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ─── Handlers de tiempo real ─────────────────────────────────────────────

  const flashRealtime = useCallback((message: string) => {
    setRealtimeFlash(message)
    setTimeout(() => setRealtimeFlash(null), 3000)
  }, [])

  const handleRealtimeDealUpdated = useCallback((payload: DealRealtimePayload) => {
    setDeals(prev =>
      prev.map(d =>
        d.id === payload.id
          ? {
              ...d,
              status: payload.status ?? d.status,
              finalPrice: payload.finalPrice ?? d.finalPrice,
              finalPriceCurrency: payload.finalPriceCurrency ?? d.finalPriceCurrency,
            }
          : d
      )
    )
    flashRealtime(`Operación actualizada en tiempo real`)
  }, [flashRealtime])

  const handleRealtimeDealCreated = useCallback((payload: DealRealtimePayload) => {
    // Si el deal ya existe (por optimistic update del mismo usuario), no duplicar
    setDeals(prev => {
      if (prev.some(d => d.id === payload.id)) return prev
      const newDeal: Deal = {
        id: payload.id,
        status: payload.status ?? 'NEGOTIATION',
        finalPrice: payload.finalPrice ?? 0,
        finalPriceCurrency: payload.finalPriceCurrency ?? 'ARS',
        createdAt: payload.createdAt ?? new Date().toISOString(),
        lead: payload.lead ?? { name: 'Nuevo cliente', phone: '' },
        unit: payload.unit ?? { title: 'Nueva unidad', type: 'CAR' },
        seller: payload.seller ?? { name: 'Vendedor' },
      }
      return [newDeal, ...prev]
    })
    flashRealtime(`Nueva operación agregada`)
  }, [flashRealtime])

  const handleRealtimeDealDeleted = useCallback((payload: DealRealtimePayload) => {
    setDeals(prev => prev.filter(d => d.id !== payload.id))
    flashRealtime(`Operación eliminada`)
  }, [flashRealtime])

  // ─── Suscripción Pusher ───────────────────────────────────────────────────

  const { isConnected } = useRealtimeDeals({
    companyId: companyId || undefined,
    currentUserId: userId,
    onDealUpdated: handleRealtimeDealUpdated,
    onDealCreated: handleRealtimeDealCreated,
    onDealDeleted: handleRealtimeDealDeleted,
  })

  // ─── Operaciones de UI ────────────────────────────────────────────────────

  async function deleteDeal(id: string) {
    if (!confirm('¿Eliminar esta operación? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeals(prev => prev.filter(d => d.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(`No se pudo eliminar: ${data?.error || data?.message || res.status}`)
      }
    } catch {
      toast.error('Error de conexión al intentar eliminar')
    }
  }

  const filteredDeals = Array.isArray(deals)
    ? deals.filter(d => {
        const matchSearch =
          d.lead.name.toLowerCase().includes(search.toLowerCase()) ||
          d.unit.title.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'ALL'
          || (statusFilter === 'ACTIVE' && ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'].includes(d.status))
          || d.status === statusFilter
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

  async function handleStatusChange(dealId: string, newStatus: string) {
    // Optimistic update
    const previousDeals = [...deals]
    setDeals(deals.map(d => d.id === dealId ? { ...d, status: newStatus } : d))

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch (err) {
      console.error(err)
      setDeals(previousDeals) // Revert on failure
      toast.error('Error al actualizar el estado de la operación')
    }
  }

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
          <h1 className="text-xl font-bold text-adaptive-primary">Operaciones</h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            <span className="text-emerald-500 font-bold">
              {deals.filter(d => d.status === 'DELIVERED').length}
            </span> entregadas · {filteredDeals.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicador de tiempo real */}
          {companyId && (
            <div
              title={isConnected ? 'Tiempo real activo' : 'Sin conexión en tiempo real'}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-500',
                isConnected
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500'
              )}
            >
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">En vivo</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setViewMode('list')}
              title="Vista Lista"
              className={cn('rounded-md p-1.5 transition-all', viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Vista Kanban"
              className={cn('rounded-md p-1.5 transition-all', viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          {userRole === 'ADMIN' && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          )}
          <Link href="/app/deals/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva Operación
            </Button>
          </Link>
        </div>
      </div>

      {/* Toast de tiempo real */}
      {realtimeFlash && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          {realtimeFlash}
        </div>
      )}

      {/* Filtros de estado */}
      <div className="flex gap-1 p-1 rounded-lg surface-secondary backdrop-blur-sm shadow-sm w-fit">
        {['ALL', 'NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              statusFilter === s ? 'surface-primary text-adaptive-primary shadow-sm' : 'text-adaptive-secondary hover:text-adaptive-primary'
            )}>
            {s === 'ALL' ? 'Todos' : statusConfig[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-adaptive-secondary" />
        <Input
          placeholder="Buscar por cliente o vehículo…"
          className="pl-9 surface-secondary backdrop-blur-sm text-adaptive-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredDeals.length === 0 ? (
        <Card className="surface-secondary">
          <CardContent className="py-16 text-center">
            <Handshake className="h-12 w-12 mx-auto mb-3 text-adaptive-secondary opacity-50" />
            <p className="font-semibold text-adaptive-primary">No se encontraron operaciones.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard deals={filteredDeals} onStatusChange={handleStatusChange} />
      ) : (
        <Card className="surface-primary overflow-hidden">
          {/* Cabecera de columnas */}
          <div className="hidden md:grid grid-cols-[1fr_1.4fr_1.4fr_0.8fr_auto_auto] gap-x-4 px-5 py-3 surface-muted border-b border-white/10 text-[11px] font-bold uppercase tracking-widest text-adaptive-secondary">
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
                    <p className="text-sm font-semibold text-adaptive-primary truncate">{deal.lead.name}</p>
                    <p className="text-xs text-adaptive-secondary truncate">{deal.lead.phone}</p>
                  </div>

                  {/* Unidad */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-adaptive-primary truncate">{deal.unit.title}</p>
                    <p className="text-xs text-adaptive-secondary capitalize">{deal.unit.type.toLowerCase()}</p>
                  </div>

                  {/* Vendedor */}
                  <div className="min-w-0">
                    <p className="text-sm text-adaptive-primary truncate">{deal.seller.name}</p>
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

