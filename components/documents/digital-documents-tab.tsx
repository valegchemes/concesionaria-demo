'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'
import { FileText, Download, CheckCircle, Clock, FileSignature, MessageCircle } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface DigitalDoc {
  id: string
  type: string
  referenceNumber: string | null
  amount: number | null
  status: string
  createdAt: string
  lead: { id: string; name: string; phone: string }
  unit: { id: string; title: string }
}

// ── Config maps ───────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'BOLETO_COMPRAVENTA', label: 'Boleto de Compraventa' },
  { value: 'RECIBO',             label: 'Recibo de Pago' },
  { value: 'CONTRATO',           label: 'Contrato' },
]
const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  GENERATED: { label: 'Generado',  bg: 'bg-blue-500/10 text-blue-500',  icon: Clock },
  SIGNED:    { label: 'Firmado',   bg: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  DRAFT:     { label: 'Borrador',  bg: 'bg-muted text-muted-foreground',   icon: FileText },
}

function buildWhatsAppUrl(phone: string, docType: string, ref: string | null, docId: string) {
  const typeLabel = DOC_TYPES.find(t => t.value === docType)?.label ?? docType
  const refStr = ref ? ` N° ${ref}` : ''
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const downloadUrl = `${baseUrl}/api/public/documents/${docId}/download`
  const msg = `Hola 👋, te hacemos llegar tu *${typeLabel}${refStr}*.\n\nPodés descargar el PDF firmado ingresando aquí:\n${downloadUrl}\n\nCualquier consulta, estamos a tu disposición. 🙌`
  const number = phone.replace(/\D/g, '')
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`
}

export function GlobalDigitalDocumentsTab() {
  const [docs, setDocs] = useState<DigitalDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/documents`)
      if (r.ok) { const d = await r.json(); setDocs(d.data ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

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

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">Cargando documentos...</div>
      ) : docs.length === 0 ? (
        <Card className="surface-secondary">
          <CardContent className="py-14 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="font-semibold text-adaptive-primary">No hay documentos generados</p>
            <p className="text-muted-foreground text-sm mt-1">
              Aquí aparecerán todos los boletos y recibos de la concesionaria.
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
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">Vehículo</th>
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
                      <td className="py-3 px-4 text-foreground">{doc.unit?.title ?? '—'}</td>
                      <td className="py-3 px-4 text-foreground">{doc.lead?.name ?? '—'}</td>
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
                          {doc.lead?.phone && (
                            <a
                              href={buildWhatsAppUrl(doc.lead.phone, doc.type, doc.referenceNumber, doc.id)}
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
    </div>
  )
}
