'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, LogOut, Plus, Users, Car, Handshake, X, Clock } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GlobalSearch } from './global-search'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: 'lead' | 'deal' | 'unit'
  title: string
  subtitle: string
  time: string
  href: string
}

const quickActions = [
  { label: 'Nuevo Lead',       href: '/app/leads/new',  icon: Users,     color: 'text-violet-500' },
  { label: 'Nueva Unidad',     href: '/app/units/new',  icon: Car,       color: 'text-emerald-500' },
  { label: 'Nueva Operación',  href: '/app/deals/new',  icon: Handshake, color: 'text-amber-500' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function AppHeaderActionsCore() {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingNotif, setLoadingNotif] = useState(false)
  const newRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (newRef.current && !newRef.current.contains(e.target as Node)) setShowNew(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function openNotifications() {
    setShowNotif(v => !v)
    if (!showNotif) {
      setLoadingNotif(true)
      try {
        const [leadsRes, dealsRes] = await Promise.all([
          fetch('/api/leads?limit=3', { cache: 'no-store' }),
          fetch('/api/deals?limit=3', { cache: 'no-store' }),
        ])
        const leadsData = leadsRes.ok ? await leadsRes.json() : { data: [] }
        const dealsData = dealsRes.ok ? await dealsRes.json() : { data: [] }

        const leadActivities: Activity[] = (leadsData.data || []).slice(0, 3).map((l: any) => ({
          id: l.id,
          type: 'lead' as const,
          title: `Nuevo lead: ${l.name}`,
          subtitle: l.source || 'Sin fuente',
          time: l.createdAt,
          href: `/app/leads/${l.id}`,
        }))
        const dealActivities: Activity[] = (dealsData.data || []).slice(0, 3).map((d: any) => ({
          id: d.id,
          type: 'deal' as const,
          title: `Operación: ${d.lead?.name || 'Cliente'}`,
          subtitle: d.unit?.title || 'Sin unidad',
          time: d.createdAt,
          href: `/app/deals/${d.id}`,
        }))

        const combined = [...leadActivities, ...dealActivities]
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 6)
        setActivities(combined)
      } catch {
        setActivities([])
      } finally {
        setLoadingNotif(false)
      }
    }
  }

  const activityIcon = (type: Activity['type']) => {
    if (type === 'lead') return <Users className="h-3.5 w-3.5 text-violet-500" />
    if (type === 'deal') return <Handshake className="h-3.5 w-3.5 text-amber-500" />
    return <Car className="h-3.5 w-3.5 text-emerald-500" />
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1">
        {/* Botón + Nuevo */}
        <div className="relative" ref={newRef}>
          <button
            onClick={() => setShowNew(v => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150',
              showNew
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white'
            )}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>

          {showNew && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl dark:bg-slate-900/90">
              <div className="p-1">
                {quickActions.map((action) => (
                  <button
                    key={action.href}
                    onClick={() => { setShowNew(false); router.push(action.href) }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <action.icon className={cn('h-4 w-4', action.color)} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Campana — Notificaciones */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className={cn(
              'relative rounded-lg p-2 transition-colors',
              showNotif
                ? 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white'
            )}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-red-500" />
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-xl dark:bg-slate-900/90">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Actividad Reciente</p>
                <button onClick={() => setShowNotif(false)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {loadingNotif ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Clock className="h-5 w-5 animate-spin mr-2" />
                    Cargando...
                  </div>
                ) : activities.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">Sin actividad reciente</div>
                ) : (
                  activities.map((act) => (
                    <button
                      key={act.id}
                      onClick={() => { setShowNotif(false); router.push(act.href) }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        {activityIcon(act.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{act.title}</p>
                        <p className="truncate text-xs text-slate-500">{act.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400">{timeAgo(act.time)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
