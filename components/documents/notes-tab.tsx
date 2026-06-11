'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import {
  Banknote, Search, Clock, CheckCircle2, AlertCircle, FileText,
  User, Car, ChevronDown, ChevronUp, Loader2, DollarSign, X, Receipt, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Payment {
  id: string
  amount: number
  date: string
  method: string
  notes?: string
}

interface Installment {
  id: string
  installmentNumber: number
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE'
  notes?: string
  payments: Payment[]
}

interface PromissoryNote {
  id: string
  amount: number
  currency: string
  issueDate: string
  dueDate: string
  notes?: string
  lead: { id: string; name: string; phone: string }
  unit: { id: string; title: string }
  installments: Installment[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig = {
  PENDING: { label: 'Pendiente', icon: Clock, className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  PAID: { label: 'Pagada', icon: CheckCircle2, className: 'text-green-500 bg-green-500/10 border-green-500/20' },
  OVERDUE: { label: 'Vencida', icon: AlertCircle, className: 'text-destructive bg-destructive/10 border-destructive/20' },
}

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de Crédito' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de Débito' },
]

function isNearDue(dueDate: string) {
  const d = new Date(dueDate)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

function noteStatus(note: PromissoryNote) {
  const total = note.installments.length
  const paid = note.installments.filter(i => i.status === 'PAID').length
  const overdue = note.installments.filter(i => i.status === 'OVERDUE').length
  if (paid === total) return { label: 'Cancelado', className: 'bg-green-500/10 text-green-500 border-green-500/20' }
  if (overdue > 0) return { label: `${overdue} vencida${overdue > 1 ? 's' : ''}`, className: 'bg-destructive/10 text-destructive border-destructive/20' }
  return { label: `${paid}/${total} cuotas pagadas`, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
}

// ─── Register Payment Modal ───────────────────────────────────────────────────

function PaymentModal({ noteId, installment, onClose, onSuccess }: {
  noteId: string
  installment: Installment
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(String(installment.amount))
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { setError('Ingresá un monto válido'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/notes/${noteId}/installments/${installment.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), method, notes }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-border">
        <div className="bg-muted text-foreground px-5 py-4 flex justify-between items-center border-b border-border">
          <div>
            <h3 className="font-bold text-base">Registrar Pago</h3>
            <p className="text-muted-foreground text-xs mt-0.5">Cuota #{installment.installmentNumber} · Vence {new Date(installment.dueDate).toLocaleDateString('es-AR')}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto *</Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-9 text-lg font-bold bg-background text-foreground"
                placeholder="0.00" autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método de Pago</Label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 text-sm">
              {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas (opcional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." className="bg-background text-foreground" />
          </div>
          {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registrando...</> : 'Confirmar Pago'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function NotesTab() {
  const router = useRouter()
  const [notes, setNotes] = useState<PromissoryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, PENDING, PAID, OVERDUE
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ noteId: string; installment: Installment } | null>(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      // If the filter is specific, we pass it to the API
      const filterParam = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/notes${filterParam}`)
      if (res.ok) {
        const json = await res.json()
        setNotes(json.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const mountedRef = useRef(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlStatus = params.get('status')
      if (urlStatus && mountedRef.current) {
        setStatusFilter(urlStatus)
      }
    }
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchNotes()
    return () => { mountedRef.current = false }
  }, [fetchNotes])

  // Filter notes locally by search query (matching lead name, lead phone, or unit title)
  const filteredNotes = notes.filter(n => {
    const q = search.toLowerCase()
    const matchLead = n.lead?.name?.toLowerCase().includes(q) || n.lead?.phone?.includes(q)
    const matchUnit = n.unit?.title?.toLowerCase().includes(q)
    return matchLead || matchUnit
  })

  // Calculate totals
  const totalCollected = notes.reduce((sum, n) => {
    return sum + n.installments.reduce((instSum, inst) => {
      return instSum + inst.payments.reduce((paySum, pay) => paySum + Number(pay.amount), 0)
    }, 0)
  }, 0)

  const totalPending = notes.reduce((sum, n) => {
    return sum + n.installments.reduce((instSum, inst) => {
      return instSum + (inst.status === 'PENDING' ? Number(inst.amount) : 0)
    }, 0)
  }, 0)

  const totalOverdue = notes.reduce((sum, n) => {
    return sum + n.installments.reduce((instSum, inst) => {
      return instSum + (inst.status === 'OVERDUE' ? Number(inst.amount) : 0)
    }, 0)
  }, 0)

  return (
    <div className="space-y-6">


      {/* KPI summaries */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500 surface-secondary">
          <CardContent className="py-4 px-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Cobrado Histórico</p>
              <p className="mt-1 text-2xl font-black text-adaptive-primary tabular-nums">{formatPrice(totalCollected, 'ARS')}</p>
              <p className="mt-0.5 text-xs text-adaptive-secondary">de todos los pagarés</p>
            </div>
            <Receipt className="h-9 w-9 text-emerald-400 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 surface-secondary">
          <CardContent className="py-4 px-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Saldo Pendiente</p>
              <p className="mt-1 text-2xl font-black text-adaptive-primary tabular-nums">{formatPrice(totalPending, 'ARS')}</p>
              <p className="mt-0.5 text-xs text-adaptive-secondary">por cobrar a clientes</p>
            </div>
            <Clock className="h-9 w-9 text-blue-400 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 surface-secondary">
          <CardContent className="py-4 px-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Saldo Atrasado / Vencido</p>
              <p className="mt-1 text-2xl font-black text-adaptive-primary tabular-nums">{formatPrice(totalOverdue, 'ARS')}</p>
              <p className="mt-0.5 text-xs text-adaptive-secondary">requiere gestión de cobro</p>
            </div>
            <AlertCircle className="h-9 w-9 text-red-400 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
          {[
            { key: 'ALL', label: 'Todos' },
            { key: 'PAID', label: 'Pagados' },
            { key: 'PENDING', label: 'Pendientes' },
            { key: 'OVERDUE', label: 'Vencidos' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                statusFilter === f.key
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                  : 'text-adaptive-secondary hover:text-adaptive-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, teléfono o vehículo…"
            className="pl-9 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin mr-2" />Cargando pagarés...
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredNotes.length === 0 && (
        <Card className="surface-secondary">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-adaptive-primary">No se encontraron pagarés</p>
            <p className="text-sm mt-1">Intentá cambiar los filtros o el término de búsqueda</p>
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      {!loading && filteredNotes.length > 0 && (
        <div className="space-y-4">
          {filteredNotes.map(note => {
            const status = noteStatus(note)
            const isExpanded = expandedNote === note.id
            const paidCount = note.installments.filter(i => i.status === 'PAID').length

            return (
              <div key={note.id} className="border border-border rounded-xl overflow-hidden shadow-sm bg-card text-card-foreground">
                {/* Note header */}
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => setExpandedNote(isExpanded ? null : note.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-muted rounded-lg">
                      <Banknote className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-base">
                        {note.currency === 'USD' ? `$${Number(note.amount).toLocaleString()} USD` : formatPrice(note.amount, 'ARS')}
                      </p>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-blue-500" />
                          <Link href={`/app/leads/${note.lead?.id}`} onClick={e => e.stopPropagation()} className="hover:underline hover:text-blue-600">
                            {note.lead?.name ?? '—'}
                          </Link>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-indigo-500" />
                          <Link href={`/app/units/${note.unit?.id}`} onClick={e => e.stopPropagation()} className="hover:underline hover:text-indigo-600">
                            {note.unit?.title ?? '—'}
                          </Link>
                        </span>
                        <span>·</span>
                        Emitido: {new Date(note.issueDate).toLocaleDateString('es-AR')}
                        <span>·</span>
                        Vence: {new Date(note.dueDate).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(paidCount / note.installments.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{paidCount}/{note.installments.length}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${status.className}`}>{status.label}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Installments accordion */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30">
                    {note.notes && (
                      <p className="text-xs text-muted-foreground px-4 py-2 border-b border-border italic">{note.notes}</p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                          <th className="text-left px-4 py-2.5 font-semibold">N°</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Monto</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Vencimiento</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Estado</th>
                          <th className="text-right px-4 py-2.5 font-semibold">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {note.installments.map(inst => {
                          const cfg = statusConfig[inst.status]
                          const StatusIcon = cfg.icon
                          const nearDue = isNearDue(inst.dueDate) && inst.status === 'PENDING'
                          const rowBg =
                            inst.status === 'OVERDUE' ? 'bg-destructive/10' :
                            nearDue ? 'bg-yellow-500/10' :
                            'bg-background'

                          return (
                            <tr key={inst.id} className={`border-b border-border last:border-0 ${rowBg}`}>
                              <td className="px-4 py-3 font-bold text-muted-foreground">#{inst.installmentNumber}</td>
                              <td className="px-4 py-3 font-semibold text-foreground">
                                {note.currency === 'USD' ? `$${Number(inst.amount).toLocaleString()} USD` : formatPrice(inst.amount, 'ARS')}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(inst.dueDate).toLocaleDateString('es-AR')}
                                {nearDue && <span className="ml-1.5 text-[9px] font-bold text-yellow-500 bg-yellow-500/20 px-1.5 py-0.5 rounded-full uppercase">Próxima</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {inst.status !== 'PAID' ? (
                                  <Button size="sm" variant="outline"
                                    className="h-7 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                                    onClick={() => setPaymentModal({ noteId: note.id, installment: inst })}>
                                    Registrar Pago
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {inst.payments[0] ? `Pagado ${new Date(inst.payments[0].date).toLocaleDateString('es-AR')}` : 'Pagado'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Payment modal */}
      {paymentModal && (
        <PaymentModal
          noteId={paymentModal.noteId}
          installment={paymentModal.installment}
          onClose={() => setPaymentModal(null)}
          onSuccess={fetchNotes}
        />
      )}
    </div>
  )
}
