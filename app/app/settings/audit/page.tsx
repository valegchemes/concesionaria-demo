'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ClipboardList, ChevronLeft, ChevronRight, Loader2, ShieldCheck, 
  ShieldAlert, X, Eye, Activity, Terminal, User, Network
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import Link from 'next/link'

interface AuditEntry {
  id: string
  action: string
  resource: string
  resourceId: string | null
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
  reason: string | null
  before: any
  after: any
  user: { name: string; email: string } | null
}

const actionColors: Record<string, string> = {
  create:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  update:     'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  delete:     'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  deactivate: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  login:      'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
}

const resources = ['ALL', 'User', 'Unit', 'Lead', 'Deal', 'Company', 'DigitalDocument']

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [resource, setResource] = useState('ALL')
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditEntry | null>(null)
  
  const { limits, loading: limitsLoading } = usePlanLimits()
  const limit = 50

  useEffect(() => { 
    if (!limitsLoading && limits.auditEnabled) {
      fetchLogs() 
    }
  }, [page, resource, limitsLoading, limits.auditEnabled])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), resource })
      const res = await fetch(`/api/audit?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (err) {
      console.error('Error fetching audit logs', err)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  function renderJsonDiff(before: any, after: any) {
    if (!before && !after) return <p className="text-xs text-muted-foreground italic">Sin cambios detallados registrados</p>
    if (!before) return (
      <div className="space-y-1.5">
        <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Objeto Creado</h5>
        <pre className="text-[11px] p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 overflow-auto max-h-48 text-emerald-600 dark:text-emerald-300 font-mono leading-relaxed">{JSON.stringify(after, null, 2)}</pre>
      </div>
    )
    if (!after) return (
      <div className="space-y-1.5">
        <h5 className="text-xs font-bold text-red-500 uppercase tracking-wider">Objeto Eliminado</h5>
        <pre className="text-[11px] p-3 rounded-lg bg-red-500/5 border border-red-500/10 overflow-auto max-h-48 text-red-600 dark:text-red-300 font-mono leading-relaxed">{JSON.stringify(before, null, 2)}</pre>
      </div>
    )
    
    // Extract changed keys
    const diff: Record<string, { before: any; after: any }> = {}
    try {
      const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      for (const key of allKeys) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          diff[key] = { before: before[key], after: after[key] }
        }
      }
    } catch (e) {
      return <pre className="text-xs p-3 rounded-lg bg-muted overflow-auto">{JSON.stringify({ antes: before, despues: after }, null, 2)}</pre>
    }
    
    if (Object.keys(diff).length === 0) {
      return <p className="text-xs text-muted-foreground italic">No se detectaron diferencias en los campos registrados</p>
    }
    
    return (
      <div className="space-y-2">
        <h5 className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Campos Modificados</h5>
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border text-xs">
          <div className="grid grid-cols-3 bg-muted/50 p-2 font-bold text-adaptive-secondary">
            <div>Propiedad</div>
            <div>Antes</div>
            <div>Después</div>
          </div>
          {Object.entries(diff).map(([key, val]) => (
            <div key={key} className="grid grid-cols-3 p-2 font-medium hover:bg-muted/10 items-center">
              <span className="font-mono text-indigo-500 truncate pr-2" title={key}>{key}</span>
              <span className="text-red-500/85 truncate pr-2 font-mono" title={JSON.stringify(val.before)}>
                {val.before !== null && val.before !== undefined ? String(val.before) : <span className="italic text-muted-foreground/30">nulo</span>}
              </span>
              <span className="text-emerald-500 truncate font-mono" title={JSON.stringify(val.after)}>
                {val.after !== null && val.after !== undefined ? String(val.after) : <span className="italic text-muted-foreground/30">nulo</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Plan Gate Overlay Screen
  if (!limitsLoading && !limits.auditEnabled) {
    return (
      <div className="mx-auto max-w-xl text-center space-y-6 py-16">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20 shadow-md">
            <ShieldAlert className="h-8 w-8 text-amber-500 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-adaptive-primary">Módulo de Auditoría Avanzada</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            El registro, control de actividad y auditoría detallada del sistema son exclusivos de los planes **Medio** y **Pro**.
          </p>
        </div>
        <Link href="/app/settings/billing">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 shadow-md shadow-indigo-500/20">
            Actualizar mi Plan
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-adaptive-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            Auditoría del Sistema
          </h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            Registro de operaciones e historial de cambios en tiempo real.
          </p>
        </div>
        <span className="text-sm font-semibold text-adaptive-secondary bg-indigo-500/10 px-3 py-1 rounded-full">{total} registros</span>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="surface-secondary border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-1.5 pt-4">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              Total Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-2xl font-black text-adaptive-primary">{total}</span>
            <span className="text-[10px] text-muted-foreground block mt-1">Registros cargados</span>
          </CardContent>
        </Card>

        <Card className="surface-secondary border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-1.5 pt-4">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-emerald-500" />
              Creaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-2xl font-black text-emerald-500">
              {logs.filter(l => l.action === 'create').length}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-1">En la página actual</span>
          </CardContent>
        </Card>

        <Card className="surface-secondary border-l-4 border-l-indigo-500 shadow-sm">
          <CardHeader className="pb-1.5 pt-4">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
              Último Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-xs font-bold text-adaptive-primary block truncate max-w-[170px]" title={logs[0] ? `${logs[0].action.toUpperCase()} ${logs[0].resource}` : 'N/A'}>
              {logs[0] ? `${logs[0].action.toUpperCase()} en ${logs[0].resource}` : 'Ninguno'}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-1">
              {logs[0] ? formatDate(logs[0].createdAt) : 'Sin datos'}
            </span>
          </CardContent>
        </Card>

        <Card className="surface-secondary border-l-4 border-l-violet-500 shadow-sm">
          <CardHeader className="pb-1.5 pt-4">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-violet-500" />
              Más Activo
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-xs font-bold text-adaptive-primary block truncate max-w-[170px]">
              {(() => {
                const counts: Record<string, number> = {}
                logs.forEach(l => {
                  const name = l.user?.name ?? 'Sistema'
                  counts[name] = (counts[name] ?? 0) + 1
                })
                return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sistema'
              })()}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-1">Usuario principal en pantalla</span>
          </CardContent>
        </Card>
      </div>

      {/* Resource Filter */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-lg surface-secondary backdrop-blur-sm shadow-sm w-fit border border-border/40">
        {resources.map(r => (
          <button
            key={r}
            onClick={() => { setResource(r); setPage(1) }}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
              resource === r
                ? 'surface-primary text-adaptive-primary shadow-sm border border-border/20'
                : 'text-adaptive-secondary hover:text-adaptive-primary hover:bg-muted/10'
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Log Table */}
      <Card className="overflow-hidden surface-primary border border-border/60">
        <CardHeader className="pb-2 border-b border-border/50 bg-muted/10">
          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            Registro de Actividad (Hacé clic en cualquier fila para ver el detalle técnico)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Sin registros de auditoría para este recurso</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {logs.map((entry, idx) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedLogForDetail(entry)}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 text-sm cursor-pointer select-none transition-colors hover:bg-muted/30 group',
                    idx % 2 === 0 ? '' : 'bg-muted/5'
                  )}
                >
                  {/* Action badge */}
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    actionColors[entry.action] ?? 'bg-slate-100 text-slate-600'
                  )}>
                    {entry.action}
                  </span>

                  {/* Resource & ID */}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-adaptive-primary">{entry.resource}</span>
                    {entry.resourceId && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono truncate">
                        #{entry.resourceId.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  {/* User */}
                  <div className="hidden md:block text-xs text-muted-foreground shrink-0 min-w-[130px] font-medium">
                    {entry.user ? (
                      <span>{entry.user.name}</span>
                    ) : (
                      <span className="italic text-muted-foreground/75">Sistema</span>
                    )}
                  </div>

                  {/* IP */}
                  {entry.ipAddress && (
                    <div className="hidden lg:block text-xs text-muted-foreground font-mono shrink-0">
                      {entry.ipAddress}
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-muted-foreground shrink-0 tabular-nums font-semibold">
                    {formatDate(entry.createdAt)}
                  </div>

                  {/* Hover action indicator */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-bold text-indigo-500">Detalles</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground font-medium">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="gap-1.5 font-semibold"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="gap-1.5 font-semibold"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de detalles de auditoría */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-all duration-300">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-adaptive-dialog-bg p-6 shadow-2xl overflow-hidden surface-secondary animate-in fade-in zoom-in duration-200">
            {/* Background elements */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

            <div className="relative space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 mb-2">
                    ID: #{selectedLogForDetail.id}
                  </span>
                  <h3 className="text-xl font-black text-adaptive-primary flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-500" />
                    Detalle del Evento de Auditoría
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="rounded-full p-1.5 hover:bg-adaptive-hover text-adaptive-secondary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider block font-bold mb-1">Acción</span>
                  <span className={cn(
                    'inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    actionColors[selectedLogForDetail.action] ?? 'bg-slate-100 text-slate-600'
                  )}>
                    {selectedLogForDetail.action}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider block font-bold mb-1">Recurso</span>
                  <span className="font-semibold text-adaptive-primary">{selectedLogForDetail.resource}</span>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider block font-bold mb-1">Usuario</span>
                  <span className="font-semibold text-adaptive-primary">
                    {selectedLogForDetail.user ? selectedLogForDetail.user.name : 'Sistema'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider block font-bold mb-1">Fecha y Hora</span>
                  <span className="font-semibold text-adaptive-primary tabular-nums">
                    {formatDate(selectedLogForDetail.createdAt)}
                  </span>
                </div>
              </div>

              {/* Advanced Network Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {selectedLogForDetail.ipAddress && (
                  <div className="p-3 border border-border rounded-lg bg-muted/10 flex items-center gap-2">
                    <Network className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block">Dirección IP</span>
                      <code className="font-mono text-adaptive-primary">{selectedLogForDetail.ipAddress}</code>
                    </div>
                  </div>
                )}
                {selectedLogForDetail.userAgent && (
                  <div className="p-3 border border-border rounded-lg bg-muted/10">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block mb-1">Dispositivo / Agente</span>
                    <code className="font-mono text-[9px] text-adaptive-primary break-all block max-h-[36px] overflow-y-auto" title={selectedLogForDetail.userAgent}>
                      {selectedLogForDetail.userAgent}
                    </code>
                  </div>
                )}
              </div>

              {/* JSON Diff Component */}
              <div className="pt-2">
                {renderJsonDiff(selectedLogForDetail.before, selectedLogForDetail.after)}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/10 px-6"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

