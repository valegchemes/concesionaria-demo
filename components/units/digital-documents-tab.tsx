'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import {
  FileText, Plus, Download, CheckCircle, Clock, FileSignature, X,
  PenLine, RotateCcw, MessageCircle,
} from 'lucide-react'

// Typed wrapper for SignatureCanvas (client-only, safe to import from 'use client' component)
import SignaturePad, { type SignaturePadHandle } from './signature-pad'

// ── Types ────────────────────────────────────────────────────────────────────
interface LeadOption { id: string; name: string; phone: string }
interface DigitalDoc {
  id: string
  type: string
  referenceNumber: string | null
  amount: number | null
  status: string
  createdAt: string
  lead: { id: string; name: string; phone: string }
  unit?: { id: string; title: string }
  accessToken?: string
}

// ── Config maps ───────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'BOLETO_COMPRAVENTA', label: 'Boleto de Compraventa' },
  { value: 'RECIBO',             label: 'Recibo de Pago' },
  { value: 'CONTRATO',           label: 'Contrato' },
]
const PAYMENT_METHODS = ['Efectivo', 'Transferencia bancaria', 'Cheque', 'Financiación', 'Mixto']
const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  GENERATED: { label: 'Generado',  bg: 'bg-blue-500/10 text-blue-500',  icon: Clock },
  SIGNED:    { label: 'Firmado',   bg: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  DRAFT:     { label: 'Borrador',  bg: 'bg-muted text-muted-foreground',   icon: FileText },
}

// ── WhatsApp message builder ──────────────────────────────────────────────────
function buildWhatsAppUrl(
  phone: string,
  docType: string,
  ref: string | null,
  docId: string,
  buyerName?: string,
  unitTitle?: string,
  accessToken?: string
) {
  const typeLabel = DOC_TYPES.find(t => t.value === docType)?.label ?? docType
  const refStr = ref ? ` N° ${ref}` : ''
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const tokenParam = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
  const downloadUrl = `${baseUrl}/api/public/documents/${docId}/download${tokenParam}`
  
  const greeting = buyerName 
    ? `Hola ${buyerName} ${String.fromCodePoint(0x1F44B)}` 
    : `Hola ${String.fromCodePoint(0x1F44B)}`
  const vehicleStr = unitTitle ? ` correspondiente al vehículo *${unitTitle}*` : ''

  const msg = `${greeting}, te hacemos llegar tu *${typeLabel}${refStr}*${vehicleStr}.\n\nPodés descargar el PDF firmado ingresando aquí:\n${downloadUrl}\n\nCualquier consulta, estamos a tu disposición. ${String.fromCodePoint(0x1F64C)}`
  const number = phone.replace(/\D/g, '')
  return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(msg)}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DigitalDocumentsTab({ unitId }: { unitId: string }) {
  const [docs, setDocs]               = useState<DigitalDoc[]>([])
  const [leads, setLeads]             = useState<LeadOption[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Signature state
  const sigRef = useRef<SignaturePadHandle | null>(null)
  const [showSig, setShowSig]         = useState(false)
  const [sigDataUrl, setSigDataUrl]   = useState<string | null>(null)

  const emptyForm = {
    type: 'BOLETO_COMPRAVENTA', leadId: '', amount: '', currency: 'ARS',
    buyerDni: '', buyerAddress: '', paymentMethod: '', paymentConditions: '', notes: '',
  }
  const [form, setForm] = useState(emptyForm)
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  // ── Fetches ────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/units/${unitId}/documents`)
      if (r.ok) { const d = await r.json(); setDocs(d.data ?? []) }
    } finally { setLoading(false) }
  }, [unitId])

  const fetchLeads = useCallback(async () => {
    try {
      const r = await fetch('/api/leads')
      if (r.ok) { const d = await r.json(); setLeads(d.data ?? []) }
    } catch (e) { console.error(e) }
  }, [])

  const mountedRef = useRef(true)

  useEffect(() => {
    fetchDocs()
    fetchLeads()
    return () => { mountedRef.current = false }
  }, [fetchDocs, fetchLeads])

  // ── Signature handlers ─────────────────────────────────────────────────────
  function clearSig() { sigRef.current?.clear(); setSigDataUrl(null) }
  function saveSig() {
    if (!sigRef.current || sigRef.current.isEmpty()) { setSigDataUrl(null); setShowSig(false); return }
    
    const dataUrl = sigRef.current.toDataURL('image/png')
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024) // base64 -> bytes approx
    
    if (sizeKB > 500) {
      alert('Firma muy grande (>500KB). Simplifique el trazo.')
      return
    }
    if (sizeKB > 200) {
      if (!confirm(`Advertencia: firma grande (${sizeKB}KB). ¿Continuar?`)) return
    }
    
    setSigDataUrl(dataUrl)
    setShowSig(false)
  }

  // ── Create document ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.leadId) { alert('Seleccioná un cliente'); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/units/${unitId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          leadId: form.leadId,
          amount: form.amount ? parseFloat(form.amount) : undefined,
          currency: form.currency,
          buyerDni: form.buyerDni || undefined,
          buyerAddress: form.buyerAddress || undefined,
          paymentMethod: form.paymentMethod || undefined,
          paymentConditions: form.paymentConditions || undefined,
          notes: form.notes || undefined,
          signatureDataUrl: sigDataUrl || undefined,
        }),
      })
      if (r.ok) {
        setShowModal(false)
        setForm(emptyForm)
        setSigDataUrl(null)
        fetchDocs()
      } else {
        const e = await r.json()
        alert(e.error || 'Error al generar documento')
      }
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  // ── Download PDF ───────────────────────────────────────────────────────────
  async function downloadPdf(docId: string, ref: string | null) {
    setDownloading(docId)
    try {
      const r = await fetch(`/api/documents/${docId}/download`)
      if (!r.ok) { alert('Error al generar el PDF'); return }
      const blob = await r.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${ref ?? docId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error(err) }
    finally { setDownloading(null) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-indigo-500" />
          Documentación Digital
        </h3>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1" /> Generar Documento
        </Button>
      </div>

      {/* Documents list */}
      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">No hay documentos generados aún</p>
            <p className="text-muted-foreground text-xs mt-1">
              Generá un boleto, recibo o contrato para este vehículo
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">N° Ref.</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Tipo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Cliente</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Monto</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Estado</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Fecha</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.DRAFT
                  const Icon = cfg.icon
                  return (
                    <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-500">{doc.referenceNumber ?? '—'}</td>
                      <td className="py-3 px-4 text-foreground">
                        {DOC_TYPES.find(t => t.value === doc.type)?.label ?? doc.type}
                      </td>
                      <td className="py-3 px-4 text-foreground">{doc.lead.name}</td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {doc.amount != null ? `ARS ${formatPrice(doc.amount)}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline"
                            className="border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/10 h-7 text-xs"
                            disabled={downloading === doc.id}
                            onClick={() => downloadPdf(doc.id, doc.referenceNumber)}>
                            <Download className="h-3 w-3 mr-1" />
                            {downloading === doc.id ? 'Generando...' : 'PDF'}
                          </Button>
                          {/* WhatsApp quick-send */}
                          {doc.lead.phone && (
                            <a
                              href={buildWhatsAppUrl(doc.lead.phone, doc.type, doc.referenceNumber, doc.id, doc.lead?.name, doc.unit?.title, doc.accessToken)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar aviso por WhatsApp"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-green-500/20 text-green-500 hover:bg-green-500/10 transition-colors"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-lg shadow-2xl my-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Generar Documento</CardTitle>
              <button onClick={() => { setShowModal(false); setSigDataUrl(null) }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Tipo y cliente */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de Documento *</Label>
                    <select value={form.type} onChange={e => upd('type', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm" required>
                      {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente (Comprador) *</Label>
                    <select value={form.leadId} onChange={e => upd('leadId', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm" required>
                      <option value="">Seleccioná un cliente...</option>
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Monto */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monto</Label>
                    <Input type="number" placeholder="0" value={form.amount}
                      onChange={e => upd('amount', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Moneda</Label>
                    <select value={form.currency} onChange={e => upd('currency', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm">
                      <option value="ARS">ARS $</option>
                      <option value="USD">USD $</option>
                    </select>
                  </div>
                </div>

                {/* Datos del comprador */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">DNI del Comprador</Label>
                    <Input placeholder="12.345.678" value={form.buyerDni}
                      onChange={e => upd('buyerDni', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Domicilio del Comprador</Label>
                    <Input placeholder="Av. Siempre Viva 742" value={form.buyerAddress}
                      onChange={e => upd('buyerAddress', e.target.value)} />
                  </div>
                </div>

                {/* Pago */}
                <div className="space-y-1">
                  <Label className="text-xs">Forma de Pago</Label>
                  <select value={form.paymentMethod} onChange={e => upd('paymentMethod', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm">
                    <option value="">Seleccioná...</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Condiciones de Pago</Label>
                  <Input placeholder="Ej: 30% al contado, saldo en 12 cuotas" value={form.paymentConditions}
                    onChange={e => upd('paymentConditions', e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notas / Observaciones</Label>
                  <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
                    className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
                    placeholder="Cualquier condición adicional..." />
                </div>

                {/* ── Firma Digital ── */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5 text-indigo-500" />
                    Firma del Comprador (Opcional)
                  </Label>

                  {sigDataUrl ? (
                    <div className="relative rounded-lg border border-green-500/30 bg-green-500/10 p-2 flex items-center gap-3">
                      <img src={sigDataUrl} alt="Firma" className="h-14 object-contain invert dark:invert-0" />
                      <div className="flex-1">
                        <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Firma capturada
                        </p>
                      </div>
                      <button type="button" onClick={() => { setSigDataUrl(null) }}
                        className="text-green-500 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full border-dashed"
                      onClick={() => setShowSig(true)}>
                      <PenLine className="h-4 w-4" />
                      Agregar Firma
                    </Button>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? 'Generando...' : 'Generar Documento'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setSigDataUrl(null) }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Signature Pad Modal ── */}
      {showSig && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <PenLine className="h-5 w-5 text-indigo-500" />
                Firma del Comprador
              </h3>
              <button onClick={() => setShowSig(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Firmá dentro del recuadro con el dedo o el mouse.</p>

            <div className="rounded-xl border-2 border-dashed border-border bg-background overflow-hidden relative">
              <SignaturePad ref={sigRef} />
            </div>

            <div className="flex items-center gap-2 justify-between">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={clearSig}>
                <RotateCcw className="h-3.5 w-3.5" /> Limpiar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSig(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5" onClick={saveSig}>
                  <CheckCircle className="h-3.5 w-3.5" /> Confirmar Firma
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
