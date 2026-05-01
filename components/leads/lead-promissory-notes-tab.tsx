'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import { FileText, Plus, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'

interface Payment { id: string; amount: number; method: string; date: string; notes?: string }
interface Installment {
  id: string; installmentNumber: number; amount: number
  dueDate: string; status: 'PENDING' | 'PAID' | 'OVERDUE'; payments: Payment[]
}
interface Note {
  id: string; amount: number; currency: string; issueDate: string
  dueDate: string; notes?: string
  unit: { id: string; title: string }
  installments: Installment[]
}
interface UnitOption { id: string; title: string; domain?: string; priceArs?: number }

const statusConfig = {
  PAID:    { label: 'Pagada',   bg: 'bg-green-100 text-green-800',  icon: CheckCircle  },
  PENDING: { label: 'Pendiente', bg: 'bg-blue-100 text-blue-800',   icon: Clock        },
  OVERDUE: { label: 'Vencida',  bg: 'bg-red-100 text-red-800',     icon: AlertCircle  },
}

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de Crédito' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de Débito' },
]

function isNearDue(dueDate: string) {
  const diff = (new Date(dueDate).getTime() - Date.now()) / 86400000
  return diff >= 0 && diff <= 7
}

interface Props {
  leadId: string
  unitId?: string    // pre-fill if lead has an interested unit
  unitTitle?: string
}

export function LeadPromissoryNotesTab({ leadId, unitId, unitTitle }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<UnitOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', notes: '' })
  const [paymentSaving, setPaymentSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amount: '', currency: 'ARS', installmentsCount: '12',
    issueDate: today, notes: '', unitId: unitId || '',
  })
  const [preview, setPreview] = useState<{ amount: number; dueDate: string }[]>([])

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`)
      if (res.ok) { const d = await res.json(); setNotes(d.data || []) }
    } finally { setLoading(false) }
  }, [leadId])

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/units?status=AVAILABLE')
      if (res.ok) {
        const d = await res.json()
        setUnits(d.data || [])
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { 
    fetchNotes()
    fetchUnits()
  }, [fetchNotes, fetchUnits])

  useEffect(() => {
    const amt = parseFloat(form.amount)
    const count = parseInt(form.installmentsCount)
    if (!amt || !count || !form.issueDate) { setPreview([]); return }
    const installAmt = Math.round((amt / count) * 100) / 100
    const start = new Date(form.issueDate)
    setPreview(Array.from({ length: count }, (_, i) => {
      const d = new Date(start); d.setMonth(d.getMonth() + i + 1)
      return { amount: installAmt, dueDate: d.toISOString() }
    }))
  }, [form.amount, form.installmentsCount, form.issueDate])

  async function createNote(e: React.FormEvent) {
    e.preventDefault()
    if (!form.unitId) { alert('Seleccioná una unidad'); return }
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          currency: form.currency,
          installmentsCount: parseInt(form.installmentsCount),
          issueDate: new Date(form.issueDate).toISOString(),
          notes: form.notes || undefined,
          unitId: form.unitId,
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ amount: '', currency: 'ARS', installmentsCount: '12', issueDate: today, notes: '', unitId: unitId || '' })
        fetchNotes()
      }
    } catch (e) { console.error(e) }
  }

  async function registerPayment(noteId: string, instId: string) {
    if (!paymentForm.amount) return
    setPaymentSaving(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/installments/${instId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          method: paymentForm.method,
          notes: paymentForm.notes || undefined,
        }),
      })
      if (res.ok) {
        setPayingInstallment(null)
        setPaymentForm({ amount: '', method: 'CASH', notes: '' })
        fetchNotes()
      }
    } catch (e) { console.error(e) }
    finally { setPaymentSaving(false) }
  }

  if (loading) return (
    <Card><CardContent className="py-12 text-center text-gray-400">Cargando pagarés...</CardContent></Card>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" />
          Pagarés y Cuotas
        </h3>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Nuevo Pagaré
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader><CardTitle className="text-base text-indigo-800">Nuevo Pagaré</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createNote} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Unidad Relacionada *</Label>
                <select 
                  value={form.unitId} 
                  onChange={e => setForm(p => ({ ...p, unitId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border text-sm bg-white"
                  required
                >
                  <option value="">Seleccioná un vehículo...</option>
                  {/* Option for the current interested unit if it's not in the list */}
                  {unitId && !units.find(u => u.id === unitId) && (
                    <option value={unitId}>{unitTitle} (Unidad de interés)</option>
                  )}
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.title} {u.domain ? `(${u.domain})` : ''} — {u.priceArs ? formatPrice(u.priceArs, 'ARS') : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400">Solo aparecen unidades con estado "Disponible".</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monto Total *</Label>
                  <Input type="number" placeholder="0" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                    <option value="ARS">ARS $</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad de Cuotas</Label>
                  <Input type="number" min="1" max="120" value={form.installmentsCount}
                    onChange={e => setForm(p => ({ ...p, installmentsCount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de Emisión</Label>
                  <Input type="date" value={form.issueDate}
                    onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notas (opcional)</Label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full min-h-[60px] px-3 py-2 rounded-md border text-sm" placeholder="Observaciones del pagaré..." />
              </div>

              {/* Installment preview */}
              {preview.length > 0 && (
                <div className="bg-white border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-600">Vista previa de cuotas</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {preview.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5 border-b last:border-0">
                        <span>Cuota {i + 1} — {new Date(p.dueDate).toLocaleDateString('es-AR')}</span>
                        <span className="font-semibold">{form.currency} {formatPrice(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Generar Pagaré</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payment modal */}
      {payingInstallment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base">Registrar Pago — Cuota {payingInstallment.installmentNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 rounded text-sm">
                Monto de cuota: <strong>{formatPrice(payingInstallment.amount)}</strong>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto Pagado *</Label>
                <Input type="number" placeholder="0" value={paymentForm.amount}
                  onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Método de Pago</Label>
                <select value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border text-sm bg-white">
                  {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notas</Label>
                <Input placeholder="Observaciones..." value={paymentForm.notes}
                  onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button disabled={paymentSaving} className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const note = notes.find(n => n.installments.some(i => i.id === payingInstallment.id))
                    if (note) registerPayment(note.id, payingInstallment.id)
                  }}>
                  {paymentSaving ? 'Guardando...' : 'Confirmar Pago'}
                </Button>
                <Button variant="ghost" onClick={() => setPayingInstallment(null)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay pagarés registrados aún</p>
            <p className="text-gray-400 text-xs mt-1">Creá el primero para comenzar a gestionar cuotas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const paid = note.installments.filter(i => i.status === 'PAID').length
            const total = note.installments.length
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0
            const isExpanded = expandedNote === note.id

            return (
              <Card key={note.id} className="overflow-hidden">
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedNote(isExpanded ? null : note.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-gray-800">
                        {note.currency} {formatPrice(note.amount)} — {total} cuotas
                      </p>
                      <p className="text-xs text-gray-500">
                        Unidad: <span className="font-medium">{note.unit.title}</span>
                        {' · '}Emitido {new Date(note.issueDate).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">{paid}/{total} pagadas</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="space-y-1.5">
                      {note.installments.map(inst => {
                        const cfg = statusConfig[inst.status]
                        const Icon = cfg.icon
                        const near = inst.status === 'PENDING' && isNearDue(inst.dueDate)

                        return (
                          <div key={inst.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg text-sm border
                              ${inst.status === 'OVERDUE' ? 'bg-red-50 border-red-200' :
                                near ? 'bg-yellow-50 border-yellow-300' :
                                inst.status === 'PAID' ? 'bg-green-50 border-green-100' :
                                'bg-gray-50 border-gray-100'}`}>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${inst.status === 'PAID' ? 'text-green-500' : inst.status === 'OVERDUE' ? 'text-red-500' : near ? 'text-yellow-500' : 'text-blue-400'}`} />
                              <div>
                                <span className="font-medium">Cuota {inst.installmentNumber}</span>
                                <span className="text-gray-500 ml-2 text-xs">
                                  {new Date(inst.dueDate).toLocaleDateString('es-AR')}
                                  {near && <span className="ml-1 text-yellow-600 font-semibold">· Próxima</span>}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>
                              <span className="font-semibold text-gray-800">{formatPrice(inst.amount)}</span>
                              {inst.status !== 'PAID' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                  onClick={() => {
                                    setPayingInstallment(inst)
                                    setPaymentForm({ amount: String(inst.amount), method: 'CASH', notes: '' })
                                  }}>
                                  <DollarSign className="h-3 w-3 mr-1" />Pagar
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
