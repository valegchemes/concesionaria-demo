'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import {
  Plus, ChevronDown, ChevronUp, Clock, CheckCircle2,
  AlertCircle, Banknote, X, Loader2, User
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadOption { id: string; name: string; phone: string }

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
  lead: { id: string; name: string }
  installments: Installment[]
}

interface Props {
  unitId: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig = {
  PENDING: { label: 'Pendiente', icon: Clock, className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  PAID: { label: 'Pagada', icon: CheckCircle2, className: 'text-green-500 bg-green-500/10 border-green-500/20' },
  OVERDUE: { label: 'Vencida', icon: AlertCircle, className: 'text-destructive bg-destructive/10 border-destructive/20' },
}

const methodLabels: Record<string, string> = {
  CASH: 'Efectivo', BANK_TRANSFER: 'Transferencia', CHECK: 'Cheque',
  CREDIT_CARD: 'T. Crédito', FINANCING: 'Financiación', CRYPTO: 'Cripto', OTHER: 'Otro',
}

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
  if (paid === total) return { label: 'Cancelado', className: 'bg-green-500/10 text-green-500' }
  if (overdue > 0) return { label: `${overdue} vencida${overdue > 1 ? 's' : ''}`, className: 'bg-destructive/10 text-destructive' }
  return { label: `${paid}/${total} cuotas pagadas`, className: 'bg-blue-500/10 text-blue-500' }
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
              {Object.entries(methodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

// ─── Create Note Form ─────────────────────────────────────────────────────────

function CreateNoteForm({ unitId, leads, onSuccess, onCancel }: {
  unitId: string
  leads: LeadOption[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    leadId: '',
    amount: '', currency: 'ARS', issueDate: new Date().toISOString().split('T')[0],
    dueDate: '', installmentCount: '12', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.leadId) { setError('Seleccioná un cliente'); return }
    if (!form.amount || !form.dueDate) { setError('Completá todos los campos requeridos'); return }
    setLoading(true)
    setError('')
    try {
      // ✅ Corrección: los pagarés se crean a través del lead, no de la unidad
      const res = await fetch(`/api/leads/${form.leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          currency: form.currency,
          installmentsCount: Number(form.installmentCount),
          issueDate: new Date(form.issueDate).toISOString(),
          notes: form.notes || undefined,
          unitId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Error al crear el pagaré')
      }
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Error al crear el pagaré')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-border rounded-xl bg-muted p-5">
      <h4 className="font-bold text-foreground mb-4">Nuevo Pagaré</h4>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Lead selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" /> Cliente (Lead) *
          </Label>
          <select value={form.leadId} onChange={e => setForm(p => ({ ...p, leadId: e.target.value }))}
            className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 text-sm" required>
            <option value="">Seleccioná un cliente...</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Monto Total *</Label>
            <Input type="number" step="0.01" placeholder="0.00" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Moneda</Label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
              className="w-full h-10 rounded-md border border-input bg-background text-foreground px-3 text-sm">
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólares</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Fecha Emisión *</Label>
            <Input type="date" value={form.issueDate}
              onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Vencimiento *</Label>
            <Input type="date" value={form.dueDate}
              onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">N° Cuotas *</Label>
            <Input type="number" min="1" max="120" value={form.installmentCount}
              onChange={e => setForm(p => ({ ...p, installmentCount: e.target.value }))} className="bg-background" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Notas (opcional)</Label>
          <Input placeholder="Observaciones del pagaré..." value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-background" />
        </div>
        {form.amount && form.installmentCount && (
          <p className="text-xs text-muted-foreground bg-background rounded p-2 border border-border">
            Se generarán <strong>{form.installmentCount}</strong> cuotas de{' '}
            <strong>{(Number(form.amount) / Number(form.installmentCount)).toFixed(2)} {form.currency}</strong> cada una.
          </p>
        )}
        {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando...</> : 'Crear Pagaré'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PromissoryNotesTab({ unitId }: Props) {
  const [notes, setNotes] = useState<PromissoryNote[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ noteId: string; installment: Installment } | null>(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/units/${unitId}/notes`)
      if (res.ok) {
        const json = await res.json()
        setNotes(json.data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [unitId])

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads')
      if (res.ok) {
        const json = await res.json()
        setLeads(json.data || [])
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchNotes(); fetchLeads() }, [fetchNotes, fetchLeads])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />Cargando pagarés...
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Pagarés y Cuotas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{notes.length} pagaré{notes.length !== 1 ? 's' : ''} registrado{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setShowForm(true); setExpandedNote(null) }} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4" />Nuevo Pagaré
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <CreateNoteForm
          unitId={unitId}
          leads={leads}
          onSuccess={() => { setShowForm(false); fetchNotes() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Notes list */}
      {notes.length === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay pagarés registrados</p>
          <p className="text-sm mt-1">Creá el primero usando el botón de arriba</p>
        </div>
      )}

      {notes.map(note => {
        const status = noteStatus(note)
        const isExpanded = expandedNote === note.id
        const paidCount = note.installments.filter(i => i.status === 'PAID').length

        return (
          <div key={note.id} className="border border-border rounded-xl overflow-hidden shadow-sm">
            {/* Note header */}
            <button
              className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors text-left"
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
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{note.lead?.name ?? '—'}</span>
                    <span>·</span>
                    Emitido: {new Date(note.issueDate).toLocaleDateString('es-AR')}
                    <span>·</span>
                    Vence: {new Date(note.dueDate).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Progress bar */}
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
