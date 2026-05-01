'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import {
  Plus, Search, Phone, Mail, Car, Clock, Trash2, Loader2,
  MessageCircle, Users, AlertCircle, CheckCircle, XCircle,
  TrendingUp, Zap, LayoutList, Columns3
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: string
  createdAt: string
  assignedTo: { name: string } | null
  interestedUnit: { title: string } | null
  tasks: { dueDate: string; isCompleted: boolean }[]
  _count: { activities: number; deals: number }
}

const sourceLabels: Record<string, string> = {
  INSTAGRAM:            'Instagram',
  FACEBOOK_MARKETPLACE: 'Facebook',
  REFERRAL:             'Referido',
  WALK_IN:              'Presencial',
  PHONE:                'Teléfono',
  WEBSITE:              'Web',
  WHATSAPP:             'WhatsApp',
  OLX:                  'OLX',
  AUTOSUSADOS:          'AutosUsados',
  OTHER:                'Otro',
}

const sourceColors: Record<string, string> = {
  INSTAGRAM:            'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  FACEBOOK_MARKETPLACE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  WHATSAPP:             'bg-green-500/10 text-green-700 dark:text-green-400',
  REFERRAL:             'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  WEBSITE:              'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  WALK_IN:              'bg-slate-200/60 text-slate-600 dark:text-slate-400',
}

const statusConfig: Record<string, { label: string; classes: string; dot: string; col: string; border: string }> = {
  NEW:             { label: 'Nuevo',      classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',         dot: 'bg-blue-400',    col: 'bg-blue-50/60 dark:bg-blue-950/20',     border: 'border-blue-200 dark:border-blue-800' },
  CONTACTED:       { label: 'Contactado', classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',       dot: 'bg-slate-400',   col: 'bg-slate-50/60 dark:bg-slate-900/30',   border: 'border-slate-200 dark:border-slate-700' },
  VISIT_SCHEDULED: { label: 'Visita',     classes: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-400',  col: 'bg-violet-50/60 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-800' },
  OFFER:           { label: 'Oferta',     classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-400',   col: 'bg-amber-50/60 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800' },
  RESERVED:        { label: 'Reservado',  classes: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-400',  col: 'bg-orange-50/60 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800' },
  SOLD:            { label: 'Vendido',    classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400', col: 'bg-emerald-50/60 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800' },
  LOST:            { label: 'Perdido',    classes: 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500',    dot: 'bg-slate-300',   col: 'bg-slate-50/40 dark:bg-slate-900/20',   border: 'border-slate-200 dark:border-slate-700' },
}

const kanbanColumns = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED', 'SOLD']

const statusFilters = [
  { key: 'ALL',    label: 'Todos',   icon: Users },
  { key: 'ACTIVE', label: 'Activos', icon: TrendingUp },
  { key: 'SOLD',   label: 'Vendidos', icon: CheckCircle },
  { key: 'LOST',   label: 'Perdidos', icon: XCircle },
]

const activeStatuses = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED']

function avatarColor(name: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ]
  return colors[name.charCodeAt(0) % colors.length]
}

function hasOverdueTask(lead: Lead): boolean {
  if (lead.status === 'LOST' || lead.status === 'SOLD') return false
  const tasks = lead.tasks || []
  if (tasks.length === 0 && ['CONTACTED', 'VISIT_SCHEDULED', 'OFFER'].includes(lead.status)) return true
  if (tasks[0] && new Date(tasks[0].dueDate) < new Date()) return true
  return false
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanCard({ lead, onDragStart, onClick }: {
  lead: Lead
  onDragStart: (e: React.DragEvent, id: string) => void
  onClick: () => void
}) {
  const overdue = hasOverdueTask(lead)
  const srcColor = sourceColors[lead.source] ?? 'bg-slate-100 text-slate-500'

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm',
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95',
        overdue ? 'border-l-4 border-l-red-400 border-r border-t border-b border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('h-8 w-8 shrink-0 rounded-full bg-gradient-to-br text-white text-xs font-bold flex items-center justify-center shadow-sm', avatarColor(lead.name))}>
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{lead.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', srcColor)}>
              {sourceLabels[lead.source] ?? lead.source}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:text-red-400">
                <AlertCircle className="h-2.5 w-2.5" />Vencido
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.phone}</span>
        </div>
        {lead.interestedUnit && (
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Car className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.interestedUnit.title}</span>
          </div>
        )}
        {lead.tasks?.[0] && (
          <div className={cn('flex items-center gap-1.5', hasOverdueTask(lead) ? 'text-red-500' : '')}>
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatDate(lead.tasks[0].dueDate)}</span>
          </div>
        )}
      </div>

      {lead.assignedTo && (
        <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px] text-slate-400">
          → {lead.assignedTo.name}
        </div>
      )}
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ status, leads, onDrop, onDragOver, onCardClick }: {
  status: string
  leads: Lead[]
  onDrop: (e: React.DragEvent, status: string) => void
  onDragOver: (e: React.DragEvent) => void
  onCardClick: (id: string) => void
}) {
  const config = statusConfig[status]
  const [isDragOver, setIsDragOver] = useState(false)
  const dragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData('leadId', id)

  return (
    <div
      className={cn('flex flex-col rounded-xl border min-w-[240px] w-[240px] flex-shrink-0', config.border)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e, status) }}
    >
      {/* Column Header */}
      <div className={cn('flex items-center justify-between rounded-t-xl px-3 py-2.5', config.col)}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', config.dot)} />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{config.label}</span>
        </div>
        <span className="rounded-full bg-white dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className={cn(
        'flex-1 space-y-2.5 overflow-y-auto p-2.5 transition-colors min-h-[100px]',
        isDragOver && 'bg-blue-50/50 dark:bg-blue-950/20 rounded-b-xl ring-2 ring-inset ring-blue-300 dark:ring-blue-700'
      )}>
        {leads.map(lead => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onDragStart={dragStart}
            onClick={() => onCardClick(lead.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-slate-400 dark:text-slate-600">
            Sin leads
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const dragId = useRef<string | null>(null)

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    try {
      const res = await fetch('/api/leads', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLeads(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteLead(id: string) {
    if (!confirm('¿Eliminar este lead? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`No se pudo eliminar el lead: ${data?.error || res.status}`)
      }
    } catch {
      alert('Error de conexión al intentar eliminar')
    }
  }

  async function updateLeadStatus(leadId: string, newStatus: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      console.error('Failed to update lead status')
      fetchLeads() // revert on error
    }
  }

  function handleDrop(e: React.DragEvent, newStatus: string) {
    const leadId = e.dataTransfer.getData('leadId')
    if (!leadId) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    updateLeadStatus(leadId, newStatus)
  }

  const filteredLeads = Array.isArray(leads)
    ? leads.filter(l => {
        const matchSearch =
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.phone.includes(search)
        const matchFilter =
          filter === 'ALL' ? true :
          filter === 'ACTIVE' ? activeStatuses.includes(l.status) :
          l.status === filter
        return matchSearch && matchFilter
      })
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalActive = leads.filter(l => activeStatuses.includes(l.status)).length
  const totalSold = leads.filter(l => l.status === 'SOLD').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestión de Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-blue-600 dark:text-blue-400 font-medium">{totalActive}</span> activos
            · <span className="text-emerald-600 dark:text-emerald-400 font-medium">{totalSold}</span> vendidos
            · {leads.length} total
          </p>
        </div>
        <div className="flex gap-2">
          {/* View Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setView('list')}
              title="Vista Lista"
              className={cn('rounded-md p-1.5 transition-all', view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              title="Vista Kanban"
              className={cn('rounded-md p-1.5 transition-all', view === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600')}
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          <Link href="/app/leads/quick">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Lead Rápido
            </Button>
          </Link>
          <Link href="/app/leads/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nuevo Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros + Buscador (only in list view) */}
      {view === 'list' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
            {statusFilters.map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                    filter === f.key
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              )
            })}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o teléfono…"
              className="pl-9 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ───────────────────────────────────────────────────── */}
      {view === 'kanban' && (
        <div>
          {/* Search bar for kanban */}
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead…"
              className="pl-9 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {kanbanColumns.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                leads={filteredLeads.filter(l => l.status === status)}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onCardClick={(id) => router.push(`/app/leads/${id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {filteredLeads.length === 0 ? (
            <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/30">
              <CardContent className="py-14 text-center">
                <Users className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">
                  {search ? 'Sin resultados para tu búsqueda' : 'No hay leads registrados'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {!search && 'Crea tu primer lead con el botón "Nuevo Lead"'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="divide-y divide-border/50 overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/30">
              {filteredLeads.map((lead, idx) => {
                const overdue = hasOverdueTask(lead)
                const status = statusConfig[lead.status] ?? { label: lead.status, classes: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
                const srcColor = sourceColors[lead.source] ?? 'bg-slate-100 text-slate-500'

                return (
                  <div
                    key={lead.id}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors duration-100 group',
                      idx % 2 === 0 ? '' : 'bg-muted/20',
                      'hover:bg-blue-50/30 dark:hover:bg-blue-950/20',
                      overdue && 'border-l-2 border-l-red-400'
                    )}
                    onClick={() => router.push(`/app/leads/${lead.id}`)}
                  >
                    <div className={cn('h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-sm', avatarColor(lead.name))}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">{lead.name}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', status.classes)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                          {status.label}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            Vencido
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
                        {lead.email && (
                          <span className="hidden sm:flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>
                        )}
                        {lead.interestedUnit && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Car className="h-3 w-3" />{lead.interestedUnit.title}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', srcColor)}>
                        {sourceLabels[lead.source] ?? lead.source}
                      </span>
                      {lead.assignedTo && (
                        <span className="text-xs text-muted-foreground">{lead.assignedTo.name}</span>
                      )}
                      {lead.tasks?.[0] && (
                        <span className={cn('flex items-center gap-1 text-[10px]', overdue ? 'text-red-500' : 'text-muted-foreground')}>
                          <Clock className="h-3 w-3" />
                          {formatDate(lead.tasks[0].dueDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" onClick={e => e.stopPropagation()}>
                      <a href={`tel:${lead.phone}`} className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 transition-colors" title="Llamar">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-md bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/60 transition-colors" title="WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/60 transition-colors" title="Email">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => deleteLead(lead.id)} title="Eliminar lead">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
