'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Plus, Search, Phone, Mail, Car, Clock, Trash2, Loader2 } from 'lucide-react'
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
  INSTAGRAM: 'Instagram',
  FACEBOOK_MARKETPLACE: 'Facebook',
  REFERRAL: 'Referido',
  WALK_IN: 'Presencial',
  PHONE: 'Teléfono',
  WEBSITE: 'Web',
  WHATSAPP: 'WhatsApp',
  OLX: 'OLX',
  AUTOSUSADOS: 'AutosUsados',
  OTHER: 'Otro',
}

// Badges de estado: estilo corporativo sutil
const statusConfig: Record<string, { label: string; classes: string }> = {
  NEW:             { label: 'Nuevo',         classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' },
  CONTACTED:       { label: 'Contactado',    classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  VISIT_SCHEDULED: { label: 'Visita',        classes: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  OFFER:           { label: 'Oferta',        classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  RESERVED:        { label: 'Reservado',     classes: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' },
  SOLD:            { label: 'Vendido',       classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  LOST:            { label: 'Perdido',       classes: 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500' },
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
        router.refresh()
        setLeads(prev => prev.filter(l => l.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`No se pudo eliminar el lead: ${data?.error || data?.message || res.status}`)
      }
    } catch {
      alert('Error de conexión al intentar eliminar')
    }
  }

  const filteredLeads = Array.isArray(leads)
    ? leads.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search)
      )
    : []

  function hasOverdueTask(lead: Lead): boolean {
    if (lead.status === 'LOST' || lead.status === 'SOLD') return false
    const tasks = lead.tasks || []
    if (tasks.length === 0 && ['CONTACTED', 'VISIT_SCHEDULED', 'OFFER'].includes(lead.status)) return true
    if (tasks[0] && new Date(tasks[0].dueDate) < new Date()) return true
    return false
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
          <h1 className="text-xl font-semibold text-foreground">Gestión de Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/leads/quick">
            <Button variant="outline" size="sm">Lead Rápido</Button>
          </Link>
          <Link href="/app/leads/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o teléfono…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista compacta */}
      {filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium">No hay leads{search ? ' que coincidan' : ' registrados'}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filteredLeads.map((lead) => {
            const overdue = hasOverdueTask(lead)
            const status = statusConfig[lead.status] ?? { label: lead.status, classes: 'bg-slate-100 text-slate-600' }

            return (
              <div
                key={lead.id}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors duration-100 group',
                  overdue && 'border-l-2 border-l-red-400'
                )}
                onClick={() => router.push(`/app/leads/${lead.id}`)}
              >
                {/* Avatar inicial */}
                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {lead.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Nombre + datos de contacto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground truncate">{lead.name}</p>
                    <span className={cn('badge shrink-0', status.classes)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />{lead.phone}
                    </span>
                    {lead.email && (
                      <span className="flex items-center gap-1 hidden sm:flex">
                        <Mail className="h-3 w-3" />{lead.email}
                      </span>
                    )}
                    {lead.interestedUnit && (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Car className="h-3 w-3" />{lead.interestedUnit.title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadatos a la derecha */}
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                  <span>{sourceLabels[lead.source] ?? lead.source}</span>
                  {lead.assignedTo && (
                    <span>{lead.assignedTo.name}</span>
                  )}
                  {lead.tasks?.[0] && (
                    <span className={cn('flex items-center gap-1', overdue ? 'text-red-500' : '')}>
                      <Clock className="h-3 w-3" />
                      {formatDate(lead.tasks[0].dueDate)}
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => deleteLead(lead.id)}
                    title="Eliminar lead"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
