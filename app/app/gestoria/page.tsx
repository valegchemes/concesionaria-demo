'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShieldAlert, RefreshCw, FileText, CheckCircle2,
  Clock, AlertCircle, HelpCircle, Eye, Search,
  TrendingUp, ArrowRight, ClipboardList, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GestoriaItem {
  id: string
  title: string
  type: string
  year: number | null
  domain: string
  status: string
  progressPercent: number
  trafficLight: 'RED' | 'YELLOW' | 'GREEN'
  notes: string
  statuses: Record<string, string>
}

export default function GestoriaDashboardPage() {
  const [data, setData] = useState<GestoriaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterLight, setFilterLight] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL')

  useEffect(() => {
    fetchGestoria()
  }, [])

  async function fetchGestoria() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/gestoria')
      if (!res.ok) throw new Error('Error al cargar gestoría')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        throw new Error(json.error || 'Error desconocido')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  // KPIs
  const totalCount = data.length
  const greenCount = data.filter(d => d.trafficLight === 'GREEN').length
  const yellowCount = data.filter(d => d.trafficLight === 'YELLOW').length
  const redCount = data.filter(d => d.trafficLight === 'RED').length

  const filteredData = data.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.domain.toLowerCase().includes(search.toLowerCase())
    const matchLight = filterLight === 'ALL' || d.trafficLight === filterLight
    return matchSearch && matchLight
  })

  // Mini helper for checklist key statuses representation
  function renderDocBadge(key: string, value: string) {
    const labels: Record<string, string> = {
      gestor_cedula: 'CÉDULA',
      gestor_08: 'F08',
      gestor_f12: 'F12',
      gestor_dominio: 'INF.DOM',
      gestor_multas: 'MULTAS',
      gestor_patentes: 'PATENTES',
      gestor_ceta: 'CETA'
    }

    const shortName = labels[key] || 'DOC'

    if (value === 'COMPLETO') {
      return (
        <span key={key} title={`${shortName}: Completo`} className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {shortName}
        </span>
      )
    }
    if (value === 'TRAMITE') {
      return (
        <span key={key} title={`${shortName}: En Trámite`} className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
          {shortName}
        </span>
      )
    }
    if (value === 'NO_APLICA') {
      return (
        <span key={key} title={`${shortName}: No Aplica`} className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-500/10 text-slate-400 border border-slate-500/10">
          {shortName}
        </span>
      )
    }
    return (
      <span key={key} title={`${shortName}: Pendiente`} className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/10 text-red-500 border border-red-500/20">
        {shortName}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-adaptive-primary flex items-center gap-2">
            Gestoría Legal y Trámites
          </h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            Monitoreo unificado de documentación legal y semáforo de transferencias de vehículos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGestoria} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {loading && (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <Card className="surface-secondary border-red-500/20">
          <CardContent className="p-8 text-center text-red-500 font-medium">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* KPIs summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="surface-secondary border border-white/5">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-adaptive-secondary">Total Unidades</p>
                <p className="mt-1 text-2xl font-black text-adaptive-primary">{totalCount}</p>
              </CardContent>
            </Card>

            <Card className="surface-secondary border border-white/5 cursor-pointer hover:border-emerald-500/30 transition-colors" onClick={() => setFilterLight('GREEN')}>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Al Día (Completo)
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{greenCount}</p>
              </CardContent>
            </Card>

            <Card className="surface-secondary border border-white/5 cursor-pointer hover:border-amber-500/30 transition-colors" onClick={() => setFilterLight('YELLOW')}>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  En Trámite
                </p>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{yellowCount}</p>
              </CardContent>
            </Card>

            <Card className="surface-secondary border border-white/5 cursor-pointer hover:border-red-500/30 transition-colors" onClick={() => setFilterLight('RED')}>
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Pendientes
                </p>
                <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">{redCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Buscador y filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-adaptive-secondary" />
              <Input
                placeholder="Buscar unidad por título o patente…"
                className="pl-9 surface-secondary border-white/5 text-adaptive-primary text-sm h-10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl surface-secondary text-xs shrink-0 self-start md:self-auto">
              {[
                { key: 'ALL', label: 'Todos' },
                { key: 'GREEN', label: 'Al Día' },
                { key: 'YELLOW', label: 'Trámite' },
                { key: 'RED', label: 'Pendientes' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterLight(f.key as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold transition-all",
                    filterLight === f.key ? "surface-primary text-adaptive-primary shadow" : "text-adaptive-secondary hover:text-adaptive-primary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Listado en Tabla */}
          {filteredData.length === 0 ? (
            <Card className="surface-secondary border-dashed border-2">
              <CardContent className="py-16 text-center text-adaptive-secondary">
                No hay trámites cargados que coincidan con la búsqueda.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-white/5 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-white/5 text-xs text-adaptive-secondary font-bold">
                    <th className="p-4">Semáforo</th>
                    <th className="p-4">Unidad / Modelo</th>
                    <th className="p-4">Patente / Dominio</th>
                    <th className="p-4">Checklist Documentos</th>
                    <th className="p-4 text-center">Progreso</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredData.map(u => (
                    <tr key={u.id} className="surface-primary hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      {/* Semáforo */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
                          u.trafficLight === 'GREEN' && "bg-emerald-500/10 text-emerald-500",
                          u.trafficLight === 'YELLOW' && "bg-amber-500/10 text-amber-500 animate-pulse",
                          u.trafficLight === 'RED' && "bg-red-500/10 text-red-500"
                        )}>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            u.trafficLight === 'GREEN' && "bg-emerald-500",
                            u.trafficLight === 'YELLOW' && "bg-amber-500",
                            u.trafficLight === 'RED' && "bg-red-500"
                          )} />
                          {u.trafficLight === 'GREEN' ? 'Al Día' : u.trafficLight === 'YELLOW' ? 'En Trámite' : 'Incompleto'}
                        </span>
                      </td>

                      {/* Unidad */}
                      <td className="p-4">
                        <p className="font-bold text-adaptive-primary">{u.title}</p>
                        <p className="text-xs text-adaptive-secondary">
                          {u.year ? `Año ${u.year}` : 'Año no especificado'} · {u.status}
                        </p>
                      </td>

                      {/* Patente */}
                      <td className="p-4 font-mono font-bold text-xs uppercase text-adaptive-primary">
                        {u.domain}
                      </td>

                      {/* Checklist */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {Object.entries(u.statuses).map(([k, v]) => renderDocBadge(k, v))}
                        </div>
                      </td>

                      {/* Progreso */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                u.trafficLight === 'GREEN' ? 'bg-emerald-500' : u.trafficLight === 'YELLOW' ? 'bg-amber-500' : 'bg-red-500'
                              )}
                              style={{ width: `${u.progressPercent}%` }}
                            />
                          </div>
                          <span className="font-black text-xs text-adaptive-primary">{u.progressPercent}%</span>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <Link href={`/app/units/${u.id}?tab=gestoria`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-adaptive-primary">
                            Gestionar
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
