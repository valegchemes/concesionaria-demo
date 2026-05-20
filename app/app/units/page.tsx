'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Car, Bike, Anchor, Edit, Trash2, Loader2, MapPin, Users, Eye, FileDown, Filter, Upload, Inbox, ArrowRightLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToExcel } from '@/lib/utils/export'

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
  createdBy?: string | null
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
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Estados para Toma de Usados
  const [tradeIns, setTradeIns] = useState<any[]>([])
  const [loadingTradeIns, setLoadingTradeIns] = useState(false)
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false)
  const [selectedTradeIn, setSelectedTradeIn] = useState<any>(null)

  // Campos para el formulario de conversión
  const [tiTitle, setTiTitle] = useState('')
  const [tiType, setTiType] = useState<'CAR' | 'MOTORCYCLE' | 'BOAT'>('CAR')
  const [tiYear, setTiYear] = useState('')
  const [tiDomain, setTiDomain] = useState('')
  const [tiVin, setTiVin] = useState('')
  const [tiEngineNumber, setTiEngineNumber] = useState('')
  const [tiCostArs, setTiCostArs] = useState('')
  const [tiCostUsd, setTiCostUsd] = useState('')
  const [tiPriceArs, setTiPriceArs] = useState('')
  const [tiPriceUsd, setTiPriceUsd] = useState('')
  const [submittingTradeIn, setSubmittingTradeIn] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlStatus = params.get('status')
      if (urlStatus) setStatusFilter(urlStatus)
    }
    fetchUnits()
    fetchTradeIns()
  }, [])

  async function fetchTradeIns() {
    try {
      setLoadingTradeIns(true)
      const res = await fetch('/api/units/trade-ins')
      if (res.ok) {
        const json = await res.json()
        setTradeIns(json.data || [])
      }
    } catch (err) {
      console.error('Error fetching trade-ins:', err)
    } finally {
      setLoadingTradeIns(false)
    }
  }

  async function handleConvertTradeIn(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTradeIn) return
    try {
      setSubmittingTradeIn(true)
      const res = await fetch('/api/units/trade-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeInId: selectedTradeIn.id,
          title: tiTitle,
          type: tiType,
          year: tiYear ? parseInt(tiYear, 10) : null,
          domain: tiDomain,
          vin: tiVin,
          engineNumber: tiEngineNumber,
          acquisitionCostArs: parseFloat(tiCostArs) || null,
          acquisitionCostUsd: parseFloat(tiCostUsd) || null,
          priceArs: parseFloat(tiPriceArs) || null,
          priceUsd: parseFloat(tiPriceUsd) || null,
        })
      })
      const json = await res.json()
      if (json.success) {
        setIsTradeInModalOpen(false)
        fetchUnits()
        fetchTradeIns()
        alert('Unidad creada con éxito en el inventario.')
      } else {
        alert(json.error || 'Error al convertir el vehículo')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setSubmittingTradeIn(false)
    }
  }

  function openConversionModal(tradeIn: any) {
    setSelectedTradeIn(tradeIn)
    setTiTitle(tradeIn.description)
    setTiType('CAR')
    setTiYear('')
    setTiDomain('')
    setTiVin('')
    setTiEngineNumber('')
    if (tradeIn.currency === 'USD') {
      setTiCostUsd(String(tradeIn.finalValue))
      setTiCostArs('')
      setTiPriceUsd(String(Math.round(tradeIn.finalValue * 1.15)))
      setTiPriceArs('')
    } else {
      setTiCostArs(String(tradeIn.finalValue))
      setTiCostUsd('')
      setTiPriceArs(String(Math.round(tradeIn.finalValue * 1.15)))
      setTiPriceUsd('')
    }
    setIsTradeInModalOpen(true)
  }

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
    const matchSearch = u.title.toLowerCase().includes(q) || (u.location?.toLowerCase().includes(q) ?? false)
    const matchStatus = statusFilter === 'ALL' || u.status === statusFilter
    const matchType = typeFilter === 'ALL' || u.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      params.set('export', 'true')
      if (search) params.set('query', search)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)

      const res = await fetch(`/api/units?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al descargar datos para la exportación profesional')
      
      const responseData = await res.json()
      const exportUnits = Array.isArray(responseData?.data) ? responseData.data : []

      if (!exportUnits.length) {
        alert('No hay unidades para exportar en este listado.')
        return
      }

      const rows = exportUnits.map((u: any) => ({
        'Título': u.title,
        'Tipo': u.type,
        'Estado': u.status,
        'Año': u.year ?? '',
        'Precio ARS': u.priceArs ?? '',
        'Precio USD': u.priceUsd ?? '',
        'Costo Adquisición ARS': u.acquisitionCostArs ?? '',
        'Costo Adquisición USD': u.acquisitionCostUsd ?? '',
        'Tipo Adquisición': u.acquisitionType ?? '',
        'Patente / Dominio': u.domain ?? '',
        'Chasis / VIN': u.vin ?? '',
        'Nro. Motor': u.engineNumber ?? '',
        'Ubicación': u.location ?? '',
        'Cargado por': u.createdBy ?? 'Desconocido',
        'Fecha Registro': u.createdAt,
      }))

      exportToExcel(rows, `Inventario_${new Date().toISOString().split('T')[0]}`, 'Inventario')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al exportar inventario')
    } finally {
      setExporting(false)
    }
  }

  const available = units.filter(u => u.status === 'AVAILABLE').length
  const reserved = units.filter(u => u.status === 'RESERVED').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-adaptive-primary">Inventario</h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            <span className="text-emerald-500 font-bold">{available}</span> disponibles
            {reserved > 0 && (
              <> · <span className="text-orange-500 font-bold">{reserved}</span> reservados</>
            )}
            {' '}· {units.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {exporting ? 'Exportando...' : 'Exportar'}
          </Button>
          <Link href="/app/units/import">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Upload className="h-4 w-4" />
              Importar
            </Button>
          </Link>
          <Link href="/app/units/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva Unidad
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 p-1 rounded-lg surface-secondary backdrop-blur-sm shadow-sm overflow-x-auto max-w-full">
          {['ALL','AVAILABLE','IN_PREP','RESERVED','SOLD','TRADE_IN'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                statusFilter === s ? 'surface-primary text-adaptive-primary shadow-sm' : 'text-adaptive-secondary hover:text-adaptive-primary'
              )}>
              {s === 'ALL' ? 'Todos' : s === 'AVAILABLE' ? 'Disponible' : s === 'IN_PREP' ? 'En prep.' : s === 'RESERVED' ? 'Reservado' : s === 'SOLD' ? 'Vendido' : 'Toma de Usados 📥'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-lg surface-secondary backdrop-blur-sm shadow-sm">
          {['ALL','CAR','MOTORCYCLE','BOAT'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === t ? 'surface-primary text-adaptive-primary shadow-sm' : 'text-adaptive-secondary hover:text-adaptive-primary'
              )}>
              {t === 'ALL' ? 'Tipo' : t === 'CAR' ? '🚗 Autos' : t === 'MOTORCYCLE' ? '🏍 Motos' : '⛵ Náutica'}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-adaptive-secondary" />
        <Input
          placeholder="Buscar por modelo o ubicación…"
          className="pl-9 surface-secondary backdrop-blur-sm text-adaptive-primary"
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

      {/* Vista de Toma de Usados */}
      {statusFilter === 'TRADE_IN' && (
        <div className="space-y-4">
          {loadingTradeIns && (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loadingTradeIns && tradeIns.length === 0 ? (
            <Card className="surface-secondary">
              <CardContent className="py-16 text-center">
                <Inbox className="h-12 w-12 mx-auto mb-3 text-adaptive-secondary opacity-50" />
                <p className="font-semibold text-adaptive-primary">No hay autos tomados en parte de pago pendientes.</p>
                <p className="text-xs text-adaptive-secondary mt-1">Los vehículos ingresados como trade-in en las operaciones cerradas aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tradeIns.map((t) => (
                <Card key={t.id} className="overflow-hidden surface-primary hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between border border-white/5 shadow-sm">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-bold uppercase mb-2">
                        <ArrowRightLeft className="h-3.5 w-3.5 animate-pulse" />
                        Toma de Usado
                      </div>
                      <h3 className="font-bold text-base text-foreground leading-snug">{t.description}</h3>
                      <p className="text-xs text-adaptive-secondary mt-2">
                        Recibido de: <span className="font-semibold text-adaptive-primary">{t.clientName}</span>
                      </p>
                      <p className="text-xs text-adaptive-secondary mt-1">
                        Por venta de: <span className="font-semibold text-adaptive-primary">{t.sourceUnitTitle}</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex justify-between items-end">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-adaptive-secondary">Valor Tomado</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {formatPriceSimple(t.finalValue, t.currency)}
                        </p>
                      </div>
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs py-1 h-8" onClick={() => openConversionModal(t)}>
                        <Plus className="h-3.5 w-3.5" />
                        Ingresar a Stock
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {statusFilter !== 'TRADE_IN' && !loading && !error && filteredUnits.length === 0 && (
        <Card className="surface-secondary">
          <CardContent className="py-16 text-center">
            <Car className="h-12 w-12 mx-auto mb-3 text-adaptive-secondary opacity-50" />
            <p className="font-semibold text-adaptive-primary">
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

      {statusFilter !== 'TRADE_IN' && !loading && !error && filteredUnits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => {
            const TypeIcon = typeIcons[unit.type] ?? Car
            const photo = unit.photos?.[0]?.url ?? null
            const status = statusConfig[unit.status] ?? { label: unit.status, classes: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
            const arsPrice = formatPriceSimple(unit.priceArs, 'ARS')
            const usdPrice = formatPriceSimple(unit.priceUsd, 'USD')
            const gradient = typeGradients[unit.type] ?? 'from-slate-700 to-slate-900'

            return (
              <Card key={unit.id} className="overflow-hidden surface-primary hover:-translate-y-1 transition-transform duration-300 group border border-white/5">
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
                      <span className="text-base font-bold text-adaptive-primary tabular-nums">{arsPrice}</span>
                    )}
                    {usdPrice && (
                      <span className={cn(
                        'text-sm tabular-nums font-semibold',
                        arsPrice ? 'text-adaptive-secondary' : 'text-base font-bold text-adaptive-primary'
                      )}>
                        {usdPrice}
                      </span>
                    )}
                    {!arsPrice && !usdPrice && (
                      <span className="text-sm text-muted-foreground italic">Sin precio</span>
                    )}
                  </div>
                  
                  {/* Creador de la unidad */}
                  {unit.createdBy && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-adaptive-secondary">
                      <Users className="h-3 w-3" />
                      Cargado por <span className="font-medium text-adaptive-primary">{unit.createdBy}</span>
                    </div>
                  )}

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

      {/* MODAL: Conversión de TradeIn a Unidad de Stock */}
      {isTradeInModalOpen && selectedTradeIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg surface-primary border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-adaptive-primary flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-yellow-500" />
                Ingresar Usado al Inventario
              </h3>
              <button onClick={() => setIsTradeInModalOpen(false)} className="text-adaptive-secondary hover:text-adaptive-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleConvertTradeIn} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <p className="text-xs text-adaptive-secondary">
                Completa los datos técnicos y de costo para ingresar el usado en la base de datos de unidades. Se creará en estado <strong>En preparación (IN_PREP)</strong>.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="tiTitle">Título / Descripción del Auto</Label>
                  <Input id="tiTitle" required value={tiTitle} onChange={(e) => setTiTitle(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="tiType">Tipo de Unidad</Label>
                  <select id="tiType" value={tiType} onChange={(e: any) => setTiType(e.target.value)} className="w-full rounded-lg border border-adaptive surface-secondary text-adaptive-primary text-sm p-2">
                    <option value="CAR">🚗 Auto</option>
                    <option value="MOTORCYCLE">🏍 Moto</option>
                    <option value="BOAT">⛵ Lancha / Náutica</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="tiYear">Año Modelo</Label>
                  <Input id="tiYear" type="number" placeholder="Ej: 2019" value={tiYear} onChange={(e) => setTiYear(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiDomain">Patente / Dominio</Label>
                  <Input id="tiDomain" placeholder="Ej: AB123CD" value={tiDomain} onChange={(e) => setTiDomain(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiVin">Chasis / VIN</Label>
                  <Input id="tiVin" placeholder="Número de chasis" value={tiVin} onChange={(e) => setTiVin(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="tiEngineNumber">Número de Motor</Label>
                  <Input id="tiEngineNumber" placeholder="Número de motor" value={tiEngineNumber} onChange={(e) => setTiEngineNumber(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiCostArs">Costo Adquisición (ARS)</Label>
                  <Input id="tiCostArs" type="number" value={tiCostArs} onChange={(e) => setTiCostArs(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiCostUsd">Costo Adquisición (USD)</Label>
                  <Input id="tiCostUsd" type="number" value={tiCostUsd} onChange={(e) => setTiCostUsd(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiPriceArs">Precio sugerido venta (ARS)</Label>
                  <Input id="tiPriceArs" type="number" value={tiPriceArs} onChange={(e) => setTiPriceArs(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tiPriceUsd">Precio sugerido venta (USD)</Label>
                  <Input id="tiPriceUsd" type="number" value={tiPriceUsd} onChange={(e) => setTiPriceUsd(e.target.value)} className="surface-secondary text-adaptive-primary" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button type="button" variant="outline" onClick={() => setIsTradeInModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submittingTradeIn} className="bg-emerald-600 hover:bg-emerald-700">
                  {submittingTradeIn ? 'Ingresando...' : 'Confirmar Ingreso'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
