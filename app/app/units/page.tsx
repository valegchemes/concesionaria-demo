'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Car, Bike, Anchor, Edit, Trash2, Loader2, MapPin, Users, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Unit {
  id: string
  type: 'CAR' | 'MOTORCYCLE' | 'BOAT'
  title: string
  status: string
  priceArs: string | number | null
  priceUsd: string | number | null
  location: string | null
  tags: string[]
  createdAt: string
  photos: Array<{ url: string }>
  _count?: { interestedLeads: number; deals: number }
}

const typeIcons = { CAR: Car, MOTORCYCLE: Bike, BOAT: Anchor }

const typeGradients = {
  CAR:        'from-slate-700 to-slate-900',
  MOTORCYCLE: 'from-orange-700 to-red-900',
  BOAT:       'from-sky-700 to-blue-900',
}

const statusConfig: Record<string, { label: string; classes: string; dot: string }> = {
  AVAILABLE: { label: 'Disponible', classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  IN_PREP:   { label: 'En prep.',   classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',      dot: 'bg-amber-500' },
  RESERVED:  { label: 'Reservado',  classes: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',   dot: 'bg-orange-500' },
  SOLD:      { label: 'Vendido',    classes: 'bg-slate-500/10 text-slate-500 dark:text-slate-400',      dot: 'bg-slate-400' },
}

function formatPriceSimple(value: string | number | null, currency: string): string {
  if (value === null || value === undefined) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export default function UnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchUnits() }, [])

  async function fetchUnits() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/units', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setUnits(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las unidades')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUnit(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta unidad?')) return
    try {
      const res = await fetch(`/api/units/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUnits(prev => prev.filter(u => u.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`No se pudo eliminar: ${data?.error || res.status}`)
      }
    } catch {
      alert('Error de conexión al intentar eliminar')
    }
  }

  const filteredUnits = units.filter(u => {
    const q = search.toLowerCase()
    return u.title.toLowerCase().includes(q) || (u.location?.toLowerCase().includes(q) ?? false)
  })

  const available = units.filter(u => u.status === 'AVAILABLE').length
  const reserved = units.filter(u => u.status === 'RESERVED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{available}</span> disponibles
            {reserved > 0 && (
              <> · <span className="text-orange-600 dark:text-orange-400 font-medium">{reserved}</span> reservados</>
            )}
            {' '}· {units.length} total
          </p>
        </div>
        <Link href="/app/units/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva Unidad
          </Button>
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por modelo o ubicación…"
          className="pl-9 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Skeletons de carga */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="overflow-hidden bg-white/60 dark:bg-slate-900/60">
              <div className="aspect-video bg-muted animate-pulse" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-5 bg-muted animate-pulse rounded w-2/5 mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <p className="text-red-500 font-medium text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchUnits}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredUnits.length === 0 && (
        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/30">
          <CardContent className="py-16 text-center">
            <Car className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {search ? 'Sin resultados para tu búsqueda.' : 'No hay unidades cargadas.'}
            </p>
            {!search && (
              <Link href="/app/units/new" className="mt-4 inline-block">
                <Button size="sm">Agregar primera unidad</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredUnits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => {
            const TypeIcon = typeIcons[unit.type] ?? Car
            const photo = unit.photos?.[0]?.url ?? null
            const status = statusConfig[unit.status] ?? { label: unit.status, classes: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
            const arsPrice = formatPriceSimple(unit.priceArs, 'ARS')
            const usdPrice = formatPriceSimple(unit.priceUsd, 'USD')
            const gradient = typeGradients[unit.type] ?? 'from-slate-700 to-slate-900'

            return (
              <Card key={unit.id} className="overflow-hidden hover:shadow-lg hover:shadow-black/10 transition-all duration-300 group bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
                {/* Imagen / Placeholder Premium */}
                <Link href={`/app/units/${unit.id}`}>
                  <div className="aspect-video bg-muted relative overflow-hidden cursor-pointer">
                    {photo ? (
                      <img
                        src={photo}
                        alt={unit.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className={cn(
                        'w-full h-full flex flex-col items-center justify-center bg-gradient-to-br text-white/60 gap-2',
                        gradient
                      )}>
                        <TypeIcon className="h-12 w-12 opacity-40" />
                        <p className="text-xs font-medium opacity-50 tracking-wide uppercase">Sin fotografía</p>
                      </div>
                    )}

                    {/* Badge de estado */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md bg-white/80 dark:bg-black/60 shadow-sm', status.classes)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                        {status.label}
                      </span>
                    </div>

                    {/* Overlay en hover con acción de ver */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg">
                        <Eye className="h-4 w-4" />
                        Ver Detalle
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Contenido */}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/app/units/${unit.id}`} className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-foreground truncate leading-snug hover:text-primary transition-colors">
                        {unit.title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/app/units/${unit.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => deleteUnit(unit.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {unit.location && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />{unit.location}
                    </p>
                  )}

                  {/* Precios */}
                  <div className="mt-3 flex items-baseline gap-2">
                    {arsPrice && (
                      <span className="text-base font-bold text-foreground tabular-nums">{arsPrice}</span>
                    )}
                    {usdPrice && (
                      <span className={cn(
                        'text-sm tabular-nums font-semibold',
                        arsPrice ? 'text-muted-foreground' : 'text-base font-bold text-foreground'
                      )}>
                        {usdPrice}
                      </span>
                    )}
                    {!arsPrice && !usdPrice && (
                      <span className="text-sm text-muted-foreground italic">Sin precio</span>
                    )}
                  </div>

                  {/* Footer: Tags + interesados */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {(unit.tags ?? []).slice(0, 3).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-muted-foreground text-[10px] rounded-md font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {(unit._count?.interestedLeads ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 shrink-0 font-semibold">
                        <Users className="h-3 w-3" />
                        {unit._count!.interestedLeads} interesados
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
