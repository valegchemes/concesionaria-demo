'use client'

import { toast } from 'sonner'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
import {
  ArrowLeft, ExternalLink, Users, Plus, Trash2, TrendingUp,
  ShoppingCart, Wrench, DollarSign, AlertCircle, FileText, Loader2, Lock, ShieldAlert, Upload
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useRef } from 'react'
import { UnitPdfTemplate } from '@/components/units/unit-pdf-template'
import { PromissoryNotesTab } from '@/components/units/promissory-notes-tab'
import { DigitalDocumentsTab } from '@/components/units/digital-documents-tab'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import { FinancingTab } from '@/components/units/financing-tab'
import { GestoriaTab } from '@/components/units/gestoria-tab'

interface CostItem {
  id: string
  concept: string
  amountArs: number | null
  amountUsd: number | null
  date: string
}

interface Unit {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  location: string | null
  tags: string[]
  priceArs: number | null
  priceUsd: number | null
  year: number | null
  vin: string | null
  domain: string | null
  engineNumber: string | null
  frameNumber: string | null
  hin: string | null
  registrationNumber: string | null
  acquisitionCostArs: number | null
  acquisitionCostUsd: number | null
  acquisitionType: string
  photos: { id: string; url: string }[]
  attributes: { id: string; key: string; value: string }[]
  costItems: CostItem[]
  interestedLeads: {
    id: string
    name: string
    status: string
    phone: string
    assignedTo: { name: string } | null
  }[]
  createdBy: { name: string } | null
}

const unitTypes: Record<string, string> = { CAR: 'Auto', MOTORCYCLE: 'Moto', BOAT: 'Lancha' }
const statuses: Record<string, string> = {
  AVAILABLE: 'Disponible', IN_PREP: 'En preparación', RESERVED: 'Reservado', SOLD: 'Vendido',
}

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Unit>>({})
  const [attributesForm, setAttributesForm] = useState<{key: string, value: string}[]>([])
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [photosForm, setPhotosForm] = useState<{ id: string; url: string; order: number }[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  // Cost form
  const [showCostForm, setShowCostForm] = useState(false)
  const [costForm, setCostForm] = useState({ concept: '', amountArs: '', amountUsd: '' })
  const [costSaving, setCostSaving] = useState(false)
  const [costError, setCostError] = useState('')

  function formatWithDots(raw: string | number | null): string {
    if (raw === null || raw === undefined) return ''
    const rawStr = typeof raw === 'number' ? raw.toString() : raw
    const digits = rawStr.replace(/\D/g, '')
    if (!digits) return ''
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(digits))
  }

  function parseFormatted(formatted: string | number | null): number | null {
    if (formatted === null || formatted === undefined || formatted === '') return null
    if (typeof formatted === 'number') return formatted
    const clean = formatted.replace(/[^\d]/g, '')
    return clean ? Number(clean) : null
  }

  // PDF Generation
  const pdfRef = useRef<HTMLDivElement>(null)
  const [company, setCompany] = useState<any>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [activeTab, setActiveTab] = useState<any>('details')
  const { limits, loading: limitsLoading } = usePlanLimits()
  const { user: currentUser } = useCurrentUser()
  const userRole = currentUser?.role ?? 'SELLER'

  async function saveUnitAttributes(updatedAttrs: { key: string; value: string }[]) {
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          attributes: updatedAttrs,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUnit(updated.data)
        setAttributesForm(updated.data.attributes || [])
        return true
      }
      return false
    } catch (e) {
      console.error(e)
      return false
    }
  }

  useEffect(() => { fetchUnit() }, [id])

  async function fetchUnit() {
    try {
      const [unitRes, companyRes] = await Promise.all([
        fetch(`/api/units/${id}`),
        fetch('/api/settings/company'),
      ])
      if (unitRes.ok) {
        const json = await unitRes.json()
        setUnit(json.data)
        setFormData({
          ...json.data,
          priceArs: formatWithDots(json.data.priceArs),
          priceUsd: formatWithDots(json.data.priceUsd),
          acquisitionCostArs: formatWithDots(json.data.acquisitionCostArs),
          acquisitionCostUsd: formatWithDots(json.data.acquisitionCostUsd),
        })
        setAttributesForm(json.data.attributes || [])
        setPhotosForm((json.data.photos || []).map((p: any, idx: number) => ({
          id: p.id,
          url: p.url,
          order: p.order ?? idx,
        })))
      }
      if (companyRes.ok) {
        const json = await companyRes.json()
        setCompany(json)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function uploadPhoto(file: File): Promise<string> {
    const { upload } = await import('@vercel/blob/client')
    const uploadUrl = `${window.location.origin}/api/blob`
    const newBlob = await upload(`units/${id}/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: uploadUrl,
    })
    return newBlob.url
  }

  async function handlePhotoUpload(files: FileList) {
    setUploadingPhotos(true)
    try {
      const urls = await Promise.all(
        Array.from(files).map(async (file) => {
          const url = await uploadPhoto(file)
          return { id: crypto.randomUUID(), url, order: photosForm.length }
        })
      )
      setPhotosForm(prev => [...prev, ...urls])
      toast.success(`${urls.length} foto(s) subida(s)`)
    } catch (e) {
      console.error(e)
      toast.error('Error subiendo fotos')
    } finally {
      setUploadingPhotos(false)
    }
  }

  function removePhoto(photoId: string) {
    setPhotosForm(prev => prev.filter(p => p.id !== photoId))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceArs: parseFormatted(formData.priceArs as unknown as string),
          priceUsd: parseFormatted(formData.priceUsd as unknown as string),
          acquisitionCostArs: parseFormatted(formData.acquisitionCostArs as unknown as string),
          acquisitionCostUsd: parseFormatted(formData.acquisitionCostUsd as unknown as string),
          year: formData.year ? Number(formData.year) : null,
          attributes: attributesForm.filter(a => a.key.trim() !== '' && a.value.trim() !== ''),
          photos: photosForm.map((p, idx) => ({ url: p.url, order: p.order ?? idx })),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUnit(updated.data)
        setIsEditing(false)
      } else {
        const errorText = await res.text()
        toast.error(`Error al guardar: ${res.status} - ${errorText}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function addCostItem() {
    setCostError('')
    if (!costForm.concept.trim()) { setCostError('Ingresá un concepto'); return }
    if (!costForm.amountArs && !costForm.amountUsd) { setCostError('Ingresá al menos un monto'); return }
    setCostSaving(true)
    try {
      const res = await fetch(`/api/units/${id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: costForm.concept,
          amountArs: parseFormatted(costForm.amountArs),
          amountUsd: parseFormatted(costForm.amountUsd),
        }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setUnit(prev => prev ? { ...prev, costItems: [newItem.data, ...(prev.costItems || [])] } : prev)
        setCostForm({ concept: '', amountArs: '', amountUsd: '' })
        setShowCostForm(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCostSaving(false)
    }
  }

  async function deleteCostItem(costId: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      const res = await fetch(`/api/units/${id}/costs/${costId}`, { method: 'DELETE' })
      if (res.ok) {
        setUnit(prev => prev ? { ...prev, costItems: prev.costItems.filter(c => c.id !== costId) } : prev)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function generatePdf() {
    if (!pdfRef.current || !unit) return
    setIsGeneratingPdf(true)
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/jpeg', 1.0)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [794, 1123],
      })
      pdf.addImage(imgData, 'JPEG', 0, 0, 794, 1123)
      pdf.save(`Ficha_${unit.title.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
      toast.error('Hubo un error al generar el PDF. Revisá la consola.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
  if (!unit) return <div className="flex items-center justify-center h-64 text-muted-foreground">Unidad no encontrada</div>

  // Cost calculations
  const costItems = unit.costItems || []
  const acqCostArs = Number(unit.acquisitionCostArs) || 0
  const acqCostUsd = Number(unit.acquisitionCostUsd) || 0
  const totalCostArs = acqCostArs + costItems.reduce((s, c) => s + (Number(c.amountArs) || 0), 0)
  const totalCostUsd = acqCostUsd + costItems.reduce((s, c) => s + (Number(c.amountUsd) || 0), 0)
  const priceArs = Number(unit.priceArs) || 0
  const marginArs = unit.priceArs ? priceArs - totalCostArs : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app/units">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1">{unit.title}</h1>
        <Button onClick={generatePdf} disabled={isGeneratingPdf} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {isGeneratingPdf ? 'Generando...' : 'Descargar Ficha'}
        </Button>
        <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm font-medium">{unitTypes[unit.type]}</span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${unit.status === 'AVAILABLE' ? 'bg-green-500/10 text-green-500' :
            unit.status === 'SOLD' ? 'bg-muted text-muted-foreground' : 'bg-yellow-500/10 text-yellow-500'
          }`}>{statuses[unit.status]}</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {[
          ['details', 'Detalles'],
          ['cotizar', 'Cotizar 💰'],
          ['notes', 'Pagarés y Cuotas'],
          ['costs', 'Costos 📈'],
          ['gestoria', 'Gestoría 🚥'],
          ['docs', 'Documentación']
        ].map(([tab, label]) => {
          const isRestricted = (tab === 'cotizar' || tab === 'gestoria' || tab === 'notes' || tab === 'docs') && !limitsLoading && !limits.documentsEnabled
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex-shrink-0 flex items-center gap-2 ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {isRestricted && <Lock className="h-3 w-3 text-amber-500" />}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Photos Gallery */}
          <Card className="overflow-hidden">
            <div className="aspect-video bg-muted relative">
              {unit.photos && unit.photos.length > 0 ? (
                <img
                  src={unit.photos[activePhotoIdx]?.url ?? unit.photos[0].url}
                  alt={unit.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sin foto</div>
              )}
              {unit.photos && unit.photos.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  {activePhotoIdx + 1} / {unit.photos.length}
                </div>
              )}
            </div>
            {unit.photos && unit.photos.length > 1 && (
              <div className="flex gap-1.5 p-2 overflow-x-auto">
                {unit.photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
                      activePhotoIdx === idx
                        ? 'border-primary opacity-100'
                        : 'border-transparent opacity-55 hover:opacity-90'
                    }`}
                  >
                    <img src={photo.url} alt={`foto ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Prices */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Precios de Venta</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {unit.priceArs ? (
                <div>
                  <p className="text-xs text-muted-foreground">Precio ARS</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(unit.priceArs, 'ARS')}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">Sin precio ARS</p>}
              {unit.priceUsd && (
                <div>
                  <p className="text-xs text-muted-foreground">Precio USD</p>
                  <p className="text-xl font-semibold">${unit.priceUsd.toLocaleString()}</p>
                </div>
              )}
              {userRole === 'ADMIN' && marginArs !== null && (
                <div className={`mt-3 p-3 rounded-lg border ${marginArs >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                  <p className="text-xs font-medium text-foreground">Margen estimado (ARS)</p>
                  <p className={`text-lg font-bold ${marginArs >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {marginArs >= 0 ? '+' : ''}{formatPrice(marginArs, 'ARS')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardContent className="p-4">
              <Link href={`/u/${unit.id}`} target="_blank">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />Ver en catálogo público
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">

          {activeTab === 'notes' && (
            !limitsLoading && !limits.documentsEnabled ? (
              <div className="mt-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                    <ShieldAlert className="h-8 w-8 text-amber-500" />
                  </div>
                </div>
                <h3 className="text-xl font-bold">Función no disponible</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  La generación de pagarés es exclusiva del Plan Pro.
                </p>
                <Link href="/app/settings/billing">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4">Actualizar Plan</Button>
                </Link>
              </div>
            ) : <PromissoryNotesTab unitId={unit.id} />
          )}

          {activeTab === 'details' && isEditing ? (
            <form onSubmit={onSubmit}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Editar Unidad</CardTitle>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={formData.title || ''} onChange={e => updateField('title', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={formData.status || ''} onValueChange={val => updateField('status', val)}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statuses).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Precio ARS</Label>
                      <Input type="text" inputMode="numeric" value={formData.priceArs || ''} onChange={e => updateField('priceArs', formatWithDots(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio USD</Label>
                      <Input type="text" inputMode="numeric" value={formData.priceUsd || ''} onChange={e => updateField('priceUsd', formatWithDots(e.target.value))} />
                    </div>
                  </div>
                  {userRole === 'ADMIN' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Costo de Compra ARS</Label>
                      <Input type="text" inputMode="numeric" placeholder="0" value={formData.acquisitionCostArs || ''} onChange={e => updateField('acquisitionCostArs', formatWithDots(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Costo de Compra USD</Label>
                      <Input type="text" inputMode="numeric" placeholder="0" value={formData.acquisitionCostUsd || ''} onChange={e => updateField('acquisitionCostUsd', formatWithDots(e.target.value))} />
                    </div>
                  </div>
                  )}
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <textarea value={formData.description || ''} onChange={e => updateField('description', e.target.value)} className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input value={formData.location || ''} onChange={e => updateField('location', e.target.value)} />
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t border-border">
                    <Label className="text-base font-semibold text-foreground">Detalles Técnicos y Legales (Documentación)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Año</Label>
                        <Input type="number" placeholder="Ej: 2024" value={formData.year || ''} onChange={e => updateField('year', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Patente / Dominio</Label>
                        <Input placeholder="Ej: AB123CD" value={formData.domain || ''} onChange={e => updateField('domain', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>VIN</Label>
                        <Input value={formData.vin || ''} onChange={e => updateField('vin', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>N° de Chasis</Label>
                        <Input value={formData.frameNumber || ''} onChange={e => updateField('frameNumber', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>N° de Motor</Label>
                        <Input value={formData.engineNumber || ''} onChange={e => updateField('engineNumber', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold text-foreground">Características Adicionales</Label>
                        <p className="text-xs text-muted-foreground">Estos datos aparecerán en la Ficha Técnica PDF.</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => setAttributesForm([...attributesForm, { key: '', value: '' }])}>
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </div>
                    {attributesForm.map((attr, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <Input placeholder="Ej: Kilómetros, Color" value={attr.key} onChange={e => {
                          const newAttr = [...attributesForm];
                          newAttr[idx].key = e.target.value;
                          setAttributesForm(newAttr);
                        }} className="flex-1" />
                        <Input placeholder="Ej: 45.000 km, Gris Plata" value={attr.value} onChange={e => {
                          const newAttr = [...attributesForm];
                          newAttr[idx].value = e.target.value;
                          setAttributesForm(newAttr);
                        }} className="flex-1" />
                        <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => {
                          setAttributesForm(attributesForm.filter((_, i) => i !== idx));
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Photos Management */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold text-foreground">Fotos de la Unidad</Label>
                        <p className="text-xs text-muted-foreground">Subí, eliminá o reordená las fotos. La primera será la portada.</p>
                      </div>
                    </div>
                    <div className="border-2 border-dashed border-border rounded-xl p-4">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => e.target.files && handlePhotoUpload(e.target.files)}
                        disabled={uploadingPhotos}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className={`cursor-pointer flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-border transition-colors ${
                          uploadingPhotos ? 'opacity-50' : 'hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">
                          {uploadingPhotos
                            ? 'Subiendo fotos...'
                            : 'Arrastra fotos aquí o hacé clic para seleccionar'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, WebP hasta 5MB cada una
                        </p>
                      </label>
                    </div>
                    {photosForm.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">Fotos actuales ({photosForm.length})</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {photosForm.map((photo, idx) => (
                            <div key={photo.id} className="relative group">
                              <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                                <img
                                  src={photo.url}
                                  alt={`Foto ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 bg-destructive/90 text-destructive-foreground rounded-full shadow-md hover:bg-destructive"
                                  onClick={() => removePhoto(photo.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-xs text-center px-1 rounded-b">
                                #{idx + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </form>
        ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Detalles</CardTitle>
                <Button onClick={() => setIsEditing(true)}>Editar</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium text-foreground">{unitTypes[unit.type]}</p></div>
                  <div><span className="text-muted-foreground">Estado:</span><p className="font-medium text-foreground">{statuses[unit.status]}</p></div>
                  {unit.vin && <div><span className="text-muted-foreground">VIN:</span><p className="font-medium text-foreground font-mono">{unit.vin}</p></div>}
                  {unit.domain && <div><span className="text-muted-foreground">Patente:</span><p className="font-medium text-foreground">{unit.domain}</p></div>}
                  {unit.engineNumber && <div><span className="text-muted-foreground">N° Motor:</span><p className="font-medium text-foreground">{unit.engineNumber}</p></div>}
                  {unit.frameNumber && <div><span className="text-muted-foreground">N° Cuadro:</span><p className="font-medium text-foreground">{unit.frameNumber}</p></div>}
                  {unit.createdBy && <div><span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>Cargado por:</span><p className="font-medium text-foreground">{unit.createdBy.name}</p></div>}
                </div>
                {unit.description && <div><span className="text-muted-foreground text-sm">Descripción:</span><p className="mt-1 text-sm text-foreground">{unit.description}</p></div>}
                {unit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unit.tags.map(tag => <span key={tag} className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">{tag}</span>)}
                  </div>
                )}
                {unit.attributes && unit.attributes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-muted-foreground text-sm font-semibold block mb-2">Características Adicionales (Ficha Técnica):</span>
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-4 rounded-lg border border-border">
                      {unit.attributes.map(attr => (
                        <div key={attr.id || attr.key}>
                          <span className="text-muted-foreground block text-xs uppercase tracking-wider">{attr.key}</span>
                          <p className="font-medium text-foreground">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              </Card>
            )}

          {(activeTab === 'details' || activeTab === 'costs') && (
          <Card className="border border-border overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border pb-6">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  Rendimiento y Costos de la Unidad
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => { setShowCostForm(!showCostForm); setCostError('') }}>
                  <Plus className="h-4 w-4 mr-1" />Agregar Gasto
                </Button>
              </div>

              {/* Advanced Diagnostics visual dashboard */}
              {priceArs > 0 && totalCostArs > 0 && (
                !limitsLoading && !limits.documentsEnabled ? (
                  <div className="mb-5 bg-slate-50 border border-slate-200/60 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-3 relative overflow-hidden min-h-[140px] shadow-sm">
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] pointer-events-none" />
                    <Lock className="h-6 w-6 text-amber-500 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">Diagnóstico de Ganancia y ROI Exclusivo del Plan Pro</p>
                      <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                        Actualizá tu suscripción al Plan Pro para calcular automáticamente el margen neto real y el retorno de inversión de esta unidad.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-5 bg-background rounded-2xl p-4 border border-border space-y-3.5 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Desglose Financiero</span>
                      <span className="text-slate-500">Precio de Venta: {formatPrice(priceArs, 'ARS')}</span>
                    </div>

                    {/* Profit Visual Bar Gauge */}
                    <div className="space-y-1">
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div 
                          style={{ width: `${Math.min(100, Math.round((totalCostArs / priceArs) * 100))}%` }} 
                          className="bg-indigo-500 h-full transition-all" 
                          title="Inversión total"
                        />
                        {marginArs !== null && marginArs > 0 && (
                          <div 
                            style={{ width: `${Math.min(100, Math.round((marginArs / priceArs) * 100))}%` }} 
                            className="bg-emerald-500 h-full transition-all" 
                            title="Margen de ganancia"
                          />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Costo Total: {Math.round((totalCostArs / priceArs) * 100)}%</span>
                        {marginArs !== null && marginArs > 0 && (
                          <span className="text-emerald-600">Ganancia Estimada: {Math.round((marginArs / priceArs) * 100)}%</span>
                        )}
                      </div>
                    </div>

                    {/* Net Margin & ROI breakdown */}
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Margen Neto Estimado</span>
                        <p className={`text-xl font-black ${marginArs !== null && marginArs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {marginArs !== null && marginArs >= 0 ? '+' : ''}{marginArs !== null ? formatPrice(marginArs, 'ARS') : 'Sin precio'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Retorno de Inversión (ROI)</span>
                        <p className={`text-xl font-black ${marginArs !== null && marginArs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {totalCostArs > 0 && marginArs !== null ? `${Math.round((marginArs / totalCostArs) * 100)}%` : '0%'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Summary totals */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-3 border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Adquisición ARS</p>
                  <p className="text-base font-bold text-foreground">{formatPrice(acqCostArs, 'ARS')}</p>
                </div>
                <div className="bg-background rounded-lg p-3 border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" />Gastos de taller ARS</p>
                  <p className="text-base font-bold text-foreground">{formatPrice(costItems.reduce((s, c) => s + (Number(c.amountArs) || 0), 0), 'ARS')}</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/20 rounded-lg flex items-center justify-between border border-indigo-100 dark:border-indigo-900/50">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400 text-sm">Costo Total ARS</span>
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">{formatPrice(totalCostArs, 'ARS')}</span>
              </div>
              {totalCostUsd > 0 && (
                <div className="mt-2 p-2 bg-muted rounded-lg flex items-center justify-between border border-border">
                  <span className="text-xs font-medium text-foreground">Costo Total USD</span>
                  <span className="text-base font-bold text-foreground">${totalCostUsd.toLocaleString()} USD</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Add cost form */}
              {showCostForm && (
                <div className="p-4 border-2 border-dashed border-border rounded-lg bg-muted/50 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Nuevo Gasto / Inversión</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Concepto *</Label>
                    <Input
                      placeholder="Ej: Cambio de cubiertas, pintura, revisión mecánica..."
                      value={costForm.concept}
                      onChange={e => setCostForm(p => ({ ...p, concept: e.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Monto ARS</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={costForm.amountArs}
                        onChange={e => setCostForm(p => ({ ...p, amountArs: formatWithDots(e.target.value) }))}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Monto USD</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={costForm.amountUsd}
                        onChange={e => setCostForm(p => ({ ...p, amountUsd: formatWithDots(e.target.value) }))}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  {costError && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{costError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addCostItem} disabled={costSaving}>
                      {costSaving ? 'Guardando...' : 'Agregar Gasto'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowCostForm(false); setCostError('') }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Acquisition cost row */}
              {(unit.acquisitionCostArs || unit.acquisitionCostUsd) && (
                <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-background rounded border border-border"><ShoppingCart className="h-4 w-4 text-foreground" /></div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Costo de Adquisición</p>
                      <p className="text-xs text-muted-foreground">Precio de compra de la unidad</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {unit.acquisitionCostArs && <p className="font-bold text-foreground">{formatPrice(unit.acquisitionCostArs, 'ARS')}</p>}
                    {unit.acquisitionCostUsd && <p className="text-sm text-muted-foreground">${unit.acquisitionCostUsd.toLocaleString()} USD</p>}
                  </div>
                </div>
              )}

              {/* Cost items list */}
              {costItems.length === 0 && !unit.acquisitionCostArs ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay gastos registrados aún</p>
                  <p className="text-xs mt-1">Agregá el costo de compra (editando la unidad) y los gastos adicionales</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {costItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg group shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted rounded"><Wrench className="h-4 w-4 text-foreground" /></div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.concept}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('es-AR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {item.amountArs && <p className="font-bold text-foreground">{formatPrice(item.amountArs, 'ARS')}</p>}
                          {item.amountUsd && <p className="text-sm text-muted-foreground">${item.amountUsd.toLocaleString()} USD</p>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteCostItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'details' && (<>
          {/* Interested Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Leads Interesados ({(unit.interestedLeads || []).length})
              </CardTitle>
              <Link href={`/app/leads/new?unitId=${unit.id}`}>
                <Button size="sm">Agregar Lead</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {(unit.interestedLeads || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">No hay leads interesados en esta unidad</p>
              ) : (
                <div className="space-y-3">
                  {(unit.interestedLeads || []).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-sm text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        {lead.assignedTo && <p className="text-xs text-muted-foreground">Asignado: {lead.assignedTo.name}</p>}
                      </div>
                      <Link href={`/app/leads/${lead.id}`}>
                        <Button size="sm" variant="outline">Ver</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </>)}
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <UnitPdfTemplate ref={pdfRef} unit={unit} company={company} />
      </div>

      {/* Documentación Digital tab */}
      {activeTab === 'docs' && (
        !limitsLoading && !limits.documentsEnabled ? (
          <div className="mt-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Función no disponible</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              La generación de boletos de compraventa, recibos y contratos es exclusiva del Plan Pro.
            </p>
            <Link href="/app/settings/billing">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4">Actualizar Plan</Button>
            </Link>
          </div>
        ) : <DigitalDocumentsTab unitId={unit.id} />
      )}

      {/* Financing tab */}
      {activeTab === 'cotizar' && (
        !limitsLoading && !limits.documentsEnabled ? (
          <div className="mt-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                <Lock className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Función no disponible</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              El simulador interactivo de financiación y la exportación de propuestas a PDF son exclusivos del Plan Pro.
            </p>
            <Link href="/app/settings/billing">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4">Actualizar Plan</Button>
            </Link>
          </div>
        ) : <FinancingTab unit={unit} company={company} />
      )}

      {/* Gestoría checklist tab */}
      {activeTab === 'gestoria' && (
        !limitsLoading && !limits.documentsEnabled ? (
          <div className="mt-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                <Lock className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Función no disponible</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              El checklist y semáforo de seguimiento de gestoría legal son exclusivos del Plan Pro.
            </p>
            <Link href="/app/settings/billing">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4">Actualizar Plan</Button>
            </Link>
          </div>
        ) : (
          <GestoriaTab 
            unitId={unit.id} 
            attributes={unit.attributes || []} 
            onSaveAttributes={saveUnitAttributes} 
          />
        )
      )}
    </div>
  )
}
