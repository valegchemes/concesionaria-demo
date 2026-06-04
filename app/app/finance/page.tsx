'use client'
import { toast } from 'sonner'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Banknote, Plus, Minus, ArrowLeftRight, Clock, RefreshCw,
  TrendingUp, TrendingDown, Calendar, Lock, Unlock, ShieldAlert,
  Loader2, DollarSign, FileText, CheckCircle2, ChevronRight, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string
  date: string
  concept: string
  type: 'INFLOW' | 'OUTFLOW'
  amount: number
  currency: 'ARS' | 'USD'
  method: string
  source: string
}

interface CashSessionData {
  session: {
    id: string
    status: 'OPEN' | 'CLOSED'
    openedAt: string
    closedAt: string | null
    openingBalance: number
    closingBalance: number | null
    actualBalance: number | null
    notes: string | null
    userName: string
  } | null
  transactions: Transaction[]
  totals: {
    totalInflowArs: number
    totalInflowUsd: number
    totalOutflowArs: number
    totalOutflowUsd: number
    expectedBalanceArs: number
    expectedBalanceUsd: number
  }
  isHistory: boolean
}

export default function FinancePage() {
  const [data, setData] = useState<CashSessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modales
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false)
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [txType, setTxType] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW')

  // Formulario Apertura
  const [openingBalance, setOpeningBalance] = useState('')
  const [openingNotes, setOpeningNotes] = useState('')

  // Formulario Cierre
  const [actualBalance, setActualBalance] = useState('')
  const [closingNotes, setClosingNotes] = useState('')

  // Formulario Transacción Manual
  const [txAmount, setTxAmount] = useState('')
  const [txCurrency, setTxCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [txConcept, setTxConcept] = useState('')

  // Acciones en progreso
  const [submitting, setSubmitting] = useState(false)

  // Filtro de Transacciones
  const [filterType, setFilterType] = useState<'ALL' | 'INFLOW' | 'OUTFLOW' | 'MANUAL'>('ALL')

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/finance/session')
      if (!res.ok) throw new Error('Error al cargar la caja diaria')
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

  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSubmitting(true)
      const res = await fetch('/api/finance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'OPEN',
          openingBalance: parseFloat(openingBalance) || 0,
          notes: openingNotes
        })
      })
      const json = await res.json()
      if (json.success) {
        setIsOpeningModalOpen(false)
        setOpeningBalance('')
        setOpeningNotes('')
        fetchSession()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Error de red al intentar abrir la caja')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseSession(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    try {
      setSubmitting(true)
      const res = await fetch('/api/finance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE',
          closingBalance: data.totals.expectedBalanceArs,
          actualBalance: parseFloat(actualBalance) || 0,
          notes: closingNotes
        })
      })
      const json = await res.json()
      if (json.success) {
        setIsClosingModalOpen(false)
        setActualBalance('')
        setClosingNotes('')
        fetchSession()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Error de red al intentar cerrar la caja')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSubmitting(true)
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(txAmount) || 0,
          currency: txCurrency,
          type: txType,
          concept: txConcept
        })
      })
      const json = await res.json()
      if (json.success) {
        setIsTxModalOpen(false)
        setTxAmount('')
        setTxConcept('')
        fetchSession()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Error de red al registrar transacción')
    } finally {
      setSubmitting(false)
    }
  }

  function formatCurrencyLocal(n: number, currency: string) {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n)
    return currency === 'USD' ? `$${formatted} USD` : `$${formatted} ARS`
  }

  const isOpen = data?.session?.status === 'OPEN'

  const filteredTransactions = data?.transactions.filter(t => {
    if (filterType === 'ALL') return true
    if (filterType === 'INFLOW') return t.type === 'INFLOW'
    if (filterType === 'OUTFLOW') return t.type === 'OUTFLOW'
    if (filterType === 'MANUAL') return t.source === 'MANUAL'
    return true
  }) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-adaptive-primary">Caja Diaria</h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            Registro, arqueo y conciliación de movimientos de caja de la concesionaria.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSession} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
          {!loading && !isOpen && (
            <Button size="sm" onClick={() => setIsOpeningModalOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Unlock className="h-3.5 w-3.5" />
              Abrir Caja
            </Button>
          )}
          {!loading && isOpen && (
            <Button size="sm" onClick={() => setIsClosingModalOpen(true)} className="gap-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-900">
              <Lock className="h-3.5 w-3.5" />
              Cerrar Caja
            </Button>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <Card className="surface-secondary">
          <CardContent className="p-8 text-center text-red-500 font-medium">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && !data?.session && (
        <Card className="surface-secondary border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Banknote className="h-12 w-12 mx-auto mb-4 text-adaptive-secondary opacity-40" />
            <p className="font-semibold text-adaptive-primary text-base">La caja está cerrada</p>
            <p className="mt-1 text-sm text-adaptive-secondary max-w-sm mx-auto">
              Abre la sesión de caja del día para comenzar a registrar transacciones, ingresos de señas y cobros de pagarés.
            </p>
            <Button onClick={() => setIsOpeningModalOpen(true)} className="mt-5 bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              <Unlock className="h-4 w-4" />
              Iniciar Caja Diaria
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data?.session && (
        <>
          {/* Alerta de sesión cerrada (Historial) */}
          {data.isHistory && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-800 dark:text-yellow-400">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Vista de Historial:</span> Actualmente estás viendo la última caja cerrada. Abre una nueva caja diaria para registrar movimientos actuales.
              </div>
            </div>
          )}

          {/* Ficha Resumen de Caja */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Saldo actual en ARS */}
            <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 surface-secondary">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-adaptive-secondary">Saldo Estimado ARS</p>
                  <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyLocal(data.totals.expectedBalanceArs, 'ARS')}
                  </p>
                </div>
                <div className="text-xs text-adaptive-secondary mt-3">
                  Apertura: {formatCurrencyLocal(data.session.openingBalance, 'ARS')}
                </div>
              </CardContent>
            </Card>

            {/* Saldo actual en USD */}
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500 surface-secondary">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-adaptive-secondary">Saldo Estimado USD</p>
                  <p className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">
                    {formatCurrencyLocal(data.totals.expectedBalanceUsd, 'USD')}
                  </p>
                </div>
                <div className="text-xs text-adaptive-secondary mt-3">
                  Acumulado de movimientos del día
                </div>
              </CardContent>
            </Card>

            {/* Detalles de Sesión */}
            <Card className="surface-secondary">
              <CardContent className="p-5 space-y-2 text-sm text-adaptive-secondary">
                <div className="flex justify-between">
                  <span className="font-semibold text-adaptive-primary">Estado:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold",
                    isOpen ? "bg-emerald-500/10 text-emerald-500 animate-pulse" : "bg-slate-500/10 text-slate-500"
                  )}>
                    {isOpen ? 'ABIERTA' : 'CERRADA'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-adaptive-primary">Operador:</span>
                  <span>{data.session.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-adaptive-primary">Abierta el:</span>
                  <span>{new Date(data.session.openedAt).toLocaleDateString('es-AR')} a las {new Date(data.session.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {data.session.closedAt && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-adaptive-primary">Cerrada el:</span>
                    <span>{new Date(data.session.closedAt).toLocaleDateString('es-AR')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Botones de acción manual (Solo si está abierta) */}
          {isOpen && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setTxType('INFLOW'); setIsTxModalOpen(true); }} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Registrar Ingreso Manual
              </Button>
              <Button size="sm" onClick={() => { setTxType('OUTFLOW'); setIsTxModalOpen(true); }} className="gap-1 bg-red-600 hover:bg-red-700">
                <Minus className="h-4 w-4" />
                Registrar Egreso Manual
              </Button>
            </div>
          )}

          {/* Gráfico / KPIs adicionales de Flujo diario */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl surface-secondary border border-white/5">
              <p className="text-[10px] uppercase font-bold text-adaptive-secondary">Total Ingresos ARS</p>
              <p className="text-lg font-black text-emerald-500 mt-1">+{formatCurrencyLocal(data.totals.totalInflowArs, 'ARS')}</p>
            </div>
            <div className="p-4 rounded-xl surface-secondary border border-white/5">
              <p className="text-[10px] uppercase font-bold text-adaptive-secondary">Total Egresos ARS</p>
              <p className="text-lg font-black text-red-500 mt-1">-{formatCurrencyLocal(data.totals.totalOutflowArs, 'ARS')}</p>
            </div>
            <div className="p-4 rounded-xl surface-secondary border border-white/5">
              <p className="text-[10px] uppercase font-bold text-adaptive-secondary">Total Ingresos USD</p>
              <p className="text-lg font-black text-emerald-500 mt-1">+{formatCurrencyLocal(data.totals.totalInflowUsd, 'USD')}</p>
            </div>
            <div className="p-4 rounded-xl surface-secondary border border-white/5">
              <p className="text-[10px] uppercase font-bold text-adaptive-secondary">Total Egresos USD</p>
              <p className="text-lg font-black text-red-500 mt-1">-{formatCurrencyLocal(data.totals.totalOutflowUsd, 'USD')}</p>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-[11px] uppercase tracking-[0.12em] font-bold text-adaptive-secondary">Movimientos en esta sesión</h2>
              <div className="flex gap-1 p-1 rounded-lg surface-secondary text-xs">
                {['ALL', 'INFLOW', 'OUTFLOW', 'MANUAL'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f as any)}
                    className={cn(
                      "px-2.5 py-1 rounded font-semibold transition-all",
                      filterType === f ? "surface-primary text-adaptive-primary shadow" : "text-adaptive-secondary hover:text-adaptive-primary"
                    )}
                  >
                    {f === 'ALL' ? 'Todos' : f === 'INFLOW' ? 'Ingresos' : f === 'OUTFLOW' ? 'Egresos' : 'Manuales'}
                  </button>
                ))}
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <Card className="surface-secondary">
                <CardContent className="py-12 text-center text-adaptive-secondary">
                  No hay transacciones registradas en esta sesión que coincidan con el filtro.
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 border-b border-white/5 text-xs text-adaptive-secondary font-bold">
                      <th className="p-3">Fecha y Hora</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Medio</th>
                      <th className="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="surface-primary hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="p-3 text-xs text-adaptive-secondary whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString('es-AR')} {new Date(t.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-adaptive-primary">{t.concept}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-adaptive-secondary uppercase font-bold tracking-wider">
                            {t.source === 'MANUAL' ? 'Manual' : t.source}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-xs font-bold",
                            t.type === 'INFLOW' ? "text-emerald-500" : "text-red-500"
                          )}>
                            {t.type === 'INFLOW' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {t.type === 'INFLOW' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-xs text-adaptive-secondary font-medium uppercase">{t.method}</span>
                        </td>
                        <td className={cn(
                          "p-3 text-right font-black whitespace-nowrap tabular-nums",
                          t.type === 'INFLOW' ? "text-emerald-500" : "text-red-500"
                        )}>
                          {t.type === 'INFLOW' ? '+' : '-'}{formatCurrencyLocal(t.amount, t.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Apertura de Caja */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-primary border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-adaptive-primary flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-500" />
                Iniciar Caja Diaria
              </h3>
              <button onClick={() => setIsOpeningModalOpen(false)} className="text-adaptive-secondary hover:text-adaptive-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleOpenSession} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="openingBalance">Saldo Inicial de Efectivo (ARS)</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  placeholder="Ej: 50000"
                  required
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="surface-secondary text-adaptive-primary"
                />
                <p className="text-[10px] text-adaptive-secondary">Monto en caja al abrir el cajón de efectivo.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="openingNotes">Notas / Observaciones</Label>
                <Input
                  id="openingNotes"
                  placeholder="Opcional: Detalle de turnos, estado de caja, etc."
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="surface-secondary text-adaptive-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpeningModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? 'Abriendo...' : 'Confirmar Apertura'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registro Transacción Manual */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-primary border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-adaptive-primary flex items-center gap-2">
                {txType === 'INFLOW' ? <Plus className="h-5 w-5 text-emerald-500" /> : <Minus className="h-5 w-5 text-red-500" />}
                Registrar {txType === 'INFLOW' ? 'Ingreso' : 'Egreso'} Manual
              </h3>
              <button onClick={() => setIsTxModalOpen(false)} className="text-adaptive-secondary hover:text-adaptive-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="txAmount">Monto</Label>
                <div className="flex gap-2">
                  <Input
                    id="txAmount"
                    type="number"
                    placeholder="Monto de la operación"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="surface-secondary text-adaptive-primary flex-1"
                  />
                  <select
                    value={txCurrency}
                    onChange={(e: any) => setTxCurrency(e.target.value)}
                    className="rounded-lg border border-adaptive surface-secondary text-adaptive-primary text-sm px-3"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="txConcept">Concepto / Descripción</Label>
                <Input
                  id="txConcept"
                  placeholder="Ej: Pago de artículos de limpieza, Ajuste de caja, etc."
                  required
                  value={txConcept}
                  onChange={(e) => setTxConcept(e.target.value)}
                  className="surface-secondary text-adaptive-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsTxModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className={txType === 'INFLOW' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}>
                  {submitting ? 'Guardando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Caja */}
      {isClosingModalOpen && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md surface-primary border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-adaptive-primary flex items-center gap-2">
                <Lock className="h-5 w-5 text-slate-500" />
                Cerrar Caja Diaria
              </h3>
              <button onClick={() => setIsClosingModalOpen(false)} className="text-adaptive-secondary hover:text-adaptive-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCloseSession} className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-white/5 text-sm space-y-2 text-adaptive-secondary">
                <div className="flex justify-between">
                  <span>Saldo Teórico ARS:</span>
                  <span className="font-bold text-adaptive-primary">{formatCurrencyLocal(data.totals.expectedBalanceArs, 'ARS')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Saldo Teórico USD:</span>
                  <span className="font-bold text-adaptive-primary">{formatCurrencyLocal(data.totals.expectedBalanceUsd, 'USD')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actualBalance">Saldo Real de Efectivo Contado (ARS)</Label>
                <Input
                  id="actualBalance"
                  type="number"
                  placeholder="Ej: 45000"
                  required
                  value={actualBalance}
                  onChange={(e) => setActualBalance(e.target.value)}
                  className="surface-secondary text-adaptive-primary"
                />
                <p className="text-[10px] text-adaptive-secondary">Suma del efectivo físico contado al momento del arqueo final.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="closingNotes">Notas / Observaciones Finales</Label>
                <Input
                  id="closingNotes"
                  placeholder="Detalles sobre sobrantes, faltantes o aclaraciones."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="surface-secondary text-adaptive-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsClosingModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
                  {submitting ? 'Cerrando...' : 'Confirmar Cierre de Caja'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
