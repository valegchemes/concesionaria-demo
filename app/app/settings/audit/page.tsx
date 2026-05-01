'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, ChevronLeft, ChevronRight, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  resource: string
  resourceId: string | null
  createdAt: string
  ipAddress: string | null
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
  const limit = 50

  useEffect(() => { fetchLogs() }, [page, resource])

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            Auditoría del Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro completo de todas las acciones realizadas en el sistema.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{total} registros</span>
      </div>

      {/* Resource Filter */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 w-fit">
        {resources.map(r => (
          <button
            key={r}
            onClick={() => { setResource(r); setPage(1) }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              resource === r
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Log Table */}
      <Card className="overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Registro de Actividad
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-muted-foreground">Sin registros de auditoría</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {logs.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 text-sm',
                    idx % 2 === 0 ? '' : 'bg-muted/10'
                  )}
                >
                  {/* Action badge */}
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    actionColors[entry.action] ?? 'bg-slate-100 text-slate-600'
                  )}>
                    {entry.action}
                  </span>

                  {/* Resource & ID */}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.resource}</span>
                    {entry.resourceId && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono truncate">
                        #{entry.resourceId.slice(0, 8)}…
                      </span>
                    )}
                  </div>

                  {/* User */}
                  <div className="hidden md:block text-xs text-muted-foreground shrink-0 min-w-[130px]">
                    {entry.user ? (
                      <span>{entry.user.name}</span>
                    ) : (
                      <span className="italic">Sistema</span>
                    )}
                  </div>

                  {/* IP */}
                  {entry.ipAddress && (
                    <div className="hidden lg:block text-xs text-muted-foreground font-mono shrink-0">
                      {entry.ipAddress}
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {formatDate(entry.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="gap-1.5"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
