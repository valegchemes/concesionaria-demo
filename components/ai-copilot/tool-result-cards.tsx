'use client'

import React from 'react'
import { Car, User, BarChart3, Handshake, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ToolResultCardProps {
  toolName: string
  result: unknown
}

// ─── Mapa de etiquetas de estado ──────────────────────────────────────────────
const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  IN_PREP: 'En Preparación',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
}
const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  VISIT_SCHEDULED: 'Visita Agendada',
  OFFER: 'En Negociación',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
  LOST: 'Perdido',
}
const UNIT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
  IN_PREP: 'text-amber-400 bg-amber-400/10 border-amber-500/20',
  RESERVED: 'text-blue-400 bg-blue-400/10 border-blue-500/20',
  SOLD: 'text-rose-400 bg-rose-400/10 border-rose-500/20',
}

// ─── Tarjeta: Lista de vehículos ─────────────────────────────────────────────
function UnitsCard({ result }: { result: any }) {
  if (!result?.units?.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-400">
        {result?.message ?? 'Sin resultados.'}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/5">
        <Car className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold text-slate-300">
          {result.found} vehículo{result.found !== 1 ? 's' : ''} encontrado{result.found !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {result.units.map((u: any) => (
          <Link
            key={u.id}
            href={`/app/units/${u.id}`}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                {u.title} {u.year ? `(${u.year})` : ''}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {u.priceArs ?? u.priceUsd ?? 'Sin precio'} · {u.location ?? 'Sin ubicación'}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <span
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-md border',
                  UNIT_STATUS_COLORS[u.status] ?? 'text-slate-400 bg-slate-700/50 border-slate-600',
                )}
              >
                {UNIT_STATUS_LABELS[u.status] ?? u.status}
              </span>
              <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-300 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Tarjeta: Lista de clientes ───────────────────────────────────────────────
function LeadsCard({ result }: { result: any }) {
  if (!result?.leads?.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-400">
        {result?.message ?? 'Sin resultados.'}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/5">
        <User className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-slate-300">
          {result.found} cliente{result.found !== 1 ? 's' : ''} encontrado{result.found !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {result.leads.map((l: any) => (
          <Link
            key={l.id}
            href={`/app/leads/${l.id}`}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                {l.name}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{l.phone}</p>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300">
                {LEAD_STATUS_LABELS[l.status] ?? l.status}
              </span>
              <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-300 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Tarjeta: Estadísticas ───────────────────────────────────────────────────
function StatsCard({ result }: { result: any }) {
  if (!result?.inventario) return null
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-xs font-semibold text-slate-300">Estadísticas del Negocio</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
          <p className="text-lg font-bold text-emerald-400">{result.inventario.disponibles}</p>
          <p className="text-[9px] text-slate-400">Autos disponibles</p>
        </div>
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 text-center">
          <p className="text-lg font-bold text-violet-400">{result.clientes.activos}</p>
          <p className="text-[9px] text-slate-400">Clientes activos</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
          <p className="text-lg font-bold text-amber-400">{result.clientes.nuevos_sin_contactar}</p>
          <p className="text-[9px] text-slate-400">Nuevos sin contactar</p>
        </div>
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center">
          <p className="text-lg font-bold text-blue-400">{result.operaciones.este_mes}</p>
          <p className="text-[9px] text-slate-400">Ops. este mes</p>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta: Operaciones ────────────────────────────────────────────────────
function DealsCard({ result }: { result: any }) {
  if (!result?.deals?.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-800/60 p-3 text-xs text-slate-400">
        {result?.message ?? 'Sin resultados.'}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/5">
        <Handshake className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-slate-300">
          {result.found} operación{result.found !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {result.deals.map((d: any) => (
          <Link
            key={d.id}
            href={d.link}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                {d.cliente} · {d.vehiculo}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{d.precio} · {d.fecha}</p>
            </div>
            <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Tarjeta: Éxito / Error genérico ─────────────────────────────────────────
function ActionResultCard({ result }: { result: any }) {
  if (!result) return null
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
        result.success
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/20 text-rose-300',
      )}
    >
      {result.success ? (
        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium">{result.message}</p>
        {result.link && (
          <Link
            href={result.link}
            className="text-[10px] underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity mt-0.5 block"
          >
            Ver en el sistema →
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal: router de tarjetas ─────────────────────────────────
export function ToolResultCard({ toolName, result }: ToolResultCardProps) {
  switch (toolName) {
    case 'searchUnits':
      return <UnitsCard result={result} />
    case 'searchLeads':
      return <LeadsCard result={result} />
    case 'getDashboardStats':
      return <StatsCard result={result} />
    case 'getDeals':
      return <DealsCard result={result} />
    case 'createLead':
    case 'updateLeadStatus':
    case 'updateUnitStatus':
      return <ActionResultCard result={result} />
    default:
      return null
  }
}
