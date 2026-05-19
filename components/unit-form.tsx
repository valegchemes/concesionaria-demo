'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreateUnitSchema, type UnitType } from '@/lib/shared/validation'
import { CreatableCombobox } from '@/components/creatable-combobox'
import { Sparkles, Camera, Check, AlertTriangle, Loader2, RefreshCw, X, FileSpreadsheet, Lock } from 'lucide-react'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

const ImageUploader = dynamic(
  () => import('@/components/image-uploader').then((mod) => mod.ImageUploader),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        Cargando uploader de imagenes...
      </div>
    ),
  }
)

type UnitFormData = {
  type: UnitType | ''
  brand: string
  model: string
  year: number
  domain: string
  engineNumber: string
  frameNumber: string
  kilometraje: string
  acquisitionCostArs: string
  acquisitionCostUsd: string
  priceUsd: string
  priceArs: string
  description: string
}

const initialFormData: UnitFormData = {
  type: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  domain: '',
  engineNumber: '',
  frameNumber: '',
  kilometraje: '',
  acquisitionCostArs: '',
  acquisitionCostUsd: '',
  priceUsd: '',
  priceArs: '',
  description: '',
}

/** Formatea un string numérico con separadores de miles (punto) al estilo argentino */
function formatWithDots(raw: string): string {
  const digits = raw.replace(/\D/g, '') // solo dígitos
  if (!digits) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(digits))
}

/** Convierte el string formateado a número puro para el payload */
function parseFormatted(formatted: string): number | null {
  const clean = formatted.replace(/[^\d]/g, '')
  return clean ? Number(clean) : null
}

export function UnitForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const { limits, loading: limitsLoading } = usePlanLimits()

  const [isScanOpen, setIsScanOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [scanWarning, setScanWarning] = useState<string | null>(null)

  const handleScan = async (mockId?: string, file?: File) => {
    setIsScanning(true)
    setScanError(null)
    setScanSuccess(false)
    setScanWarning(null)

    try {
      let body: any = {}
      if (mockId) {
        body = { mockId }
      } else if (file) {
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = (err) => reject(err)
        })
        reader.readAsDataURL(file)
        const base64 = await base64Promise
        body = { image: base64 }
      } else {
        throw new Error('Selecciona un archivo o un ejemplo de prueba.')
      }

      const res = await fetch('/api/units/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Error al escanear la cédula')
      }

      const resJson = await res.json()
      if (resJson.success && resJson.data) {
        const data = resJson.data
        setFormData(prev => ({
          ...prev,
          type: data.type || prev.type,
          brand: data.brand || prev.brand,
          model: data.model || prev.model,
          year: data.year ? Number(data.year) : prev.year,
          domain: data.domain || prev.domain,
          engineNumber: data.engineNumber || prev.engineNumber,
          frameNumber: data.frameNumber || prev.frameNumber,
          kilometraje: data.kilometraje || prev.kilometraje,
          description: data.description || prev.description
        }))
        
        setScanSuccess(true)
        if (resJson.warning) {
          setScanWarning(resJson.warning)
        }
        
        // Auto-close dialog upon success after a brief visual confirmation
        setTimeout(() => {
          setIsScanOpen(false)
          setScanSuccess(false)
        }, 1200)
      } else {
        throw new Error('No se pudo extraer la información del vehículo.')
      }
    } catch (err: any) {
      setScanError(err.message || 'Error al procesar el escaneo.')
    } finally {
      setIsScanning(false)
    }
  }

  const [formData, setFormData] = useState<UnitFormData>(initialFormData)
  const [dictionary, setDictionary] = useState<{brand: string, models: string[]}[]>([])
  const [isLoadingDictionary, setIsLoadingDictionary] = useState(true)

  useEffect(() => {
    fetch('/api/units/dictionary')
      .then(res => res.json())
      .then(data => {
        if (data.data) setDictionary(data.data)
      })
      .catch(err => console.error('Error fetching dictionary:', err))
      .finally(() => setIsLoadingDictionary(false))
  }, [])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || prev.year : value,
    }))
  }

  const handleFieldChange = (name: keyof UnitFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'brand' && prev.brand !== value ? { model: '' } : {}), // Resetear modelo al cambiar la marca
    }))
  }

  /** Manejador especial para campos de precio — formatea con puntos al escribir */
  const handlePriceChange = (name: keyof UnitFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatWithDots(e.target.value)
      setFormData((prev) => ({ ...prev, [name]: formatted }))
    }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const title = `${formData.brand} ${formData.model} ${formData.year}`.trim()
      
      const payload = {
        title,
        type: formData.type,
        acquisitionCostArs: parseFormatted(formData.acquisitionCostArs),
        acquisitionCostUsd: parseFormatted(formData.acquisitionCostUsd),
        priceUsd: parseFormatted(formData.priceUsd),
        priceArs: parseFormatted(formData.priceArs),
        description: formData.description,
        domain: formData.domain.trim() || undefined,
        engineNumber: formData.engineNumber.trim() || undefined,
        frameNumber: formData.frameNumber.trim() || undefined,
        attributes: formData.kilometraje.trim() ? [{ key: 'kilometraje', value: formData.kilometraje.trim() }] : undefined,
        brand: formData.brand,
        model: formData.model,
        photos: images.map((url, index) => ({ url, order: index })),
      }

      const result = CreateUnitSchema.safeParse(payload)
      
      if (!result.success) {
        const firstError = result.error.errors[0]
        throw new Error(firstError?.message || 'Datos inválidos')
      }

      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result.data),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al crear la unidad')
      }

      const resultJson = await response.json()
      
      setFormData(initialFormData)
      setImages([])

      router.push(`/app/units/${resultJson.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            Agregar Nueva Unidad
          </h2>
          <p className="text-sm opacity-90">
            Complete el formulario o escanee una Cédula para cargar la información al instante.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => { setIsScanOpen(true); setScanError(null); setScanSuccess(false); }}
          className="bg-white hover:bg-slate-50 text-indigo-700 font-bold px-4 py-2.5 rounded-xl shadow-md border-none flex items-center gap-2 self-start md:self-auto transition-transform hover:scale-[1.03]"
        >
          <Sparkles className="h-4 w-4 animate-pulse text-indigo-600" />
          Carga Rápida con IA
        </Button>
      </div>

      {/* Stunning AI Scanner Modal / Drawer Overlay */}
      {isScanOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-lg">Escáner de Cédulas Automotor</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsScanOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {!limitsLoading && !limits.documentsEnabled ? (
                <div className="text-center py-8 space-y-5 flex flex-col items-center">
                  <div className="h-16 w-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200 text-amber-500 ring-4 ring-amber-50">
                    <Lock className="h-7 w-7" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h4 className="text-lg font-bold text-slate-800">Función Exclusiva del Plan Pro</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      El escaneo inteligente de cédulas y carga express por IA está disponible únicamente para suscriptores del Plan Pro. ¡Ahorrá tiempo cargando vehículos al instante!
                    </p>
                  </div>
                  <Link href="/app/settings/billing" className="w-full pt-2">
                    <Button type="button" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-sm">
                      Actualizar al Plan Pro 🚀
                    </Button>
                  </Link>
                </div>
              ) : scanError ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <p className="text-sm font-medium">{scanError}</p>
                </div>
              ) : scanSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                    <Check className="h-8 w-8" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">¡Cédula Escaneada con Éxito!</h4>
                  <p className="text-sm text-slate-500">Auto-completando los campos del vehículo...</p>
                  {scanWarning && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg max-w-sm mx-auto">{scanWarning}</p>
                  )}
                </div>
              ) : isScanning ? (
                <div className="text-center py-12 space-y-5">
                  <div className="relative w-28 h-20 bg-slate-100 rounded-xl border-2 border-indigo-200 mx-auto overflow-hidden flex items-center justify-center">
                    {/* Visual laser scanner scanning line */}
                    <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-[bounce_2s_infinite]" />
                    <Camera className="h-8 w-8 text-indigo-400 opacity-60" />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                    <span className="font-semibold text-slate-700 text-sm">Analizando imagen mediante IA...</span>
                    <span className="text-xs text-slate-400">Leyendo marca, modelo, año, patente y números de chasis/motor</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* File Upload Selector */}
                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/70 transition-colors flex flex-col items-center justify-center gap-2 group cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleScan(undefined, file)
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Camera className="h-10 w-10 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span className="font-semibold text-slate-700 text-sm">Saca una foto o subí la Cédula</span>
                    <span className="text-xs text-slate-400">Formatos compatibles: JPG, PNG.</span>
                  </div>

                  {/* Interactive Samples / Mocks */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Simulador Express de Prueba</span>
                    </div>
                    <p className="text-xs text-slate-500">¿Querés probar la experiencia al instante? Elegí una de las cédulas de muestra cargadas en el simulador:</p>
                    <div className="grid grid-cols-2 gap-3.5">
                      {[
                        { id: 'cronos', label: 'Fiat Cronos 2023', domain: 'AF329JK' },
                        { id: 'hilux', label: 'Toyota Hilux 2021', domain: 'AE529OP' },
                        { id: 'fiesta', label: 'Ford Fiesta 2017', domain: 'AB829KL' },
                        { id: 'tornado', label: 'Honda XR 250 (Moto)', domain: 'A157JKL' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleScan(item.id)}
                          className="p-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all text-left flex flex-col shadow-sm text-xs font-semibold"
                        >
                          <span className="text-slate-800 mb-0.5">{item.label}</span>
                          <span className="text-indigo-600 font-mono text-[10px]">Patente: {item.domain}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScanOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <Label htmlFor="type">Tipo de Unidad *</Label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Seleccionar tipo</option>
          <option value="CAR">Automóvil</option>
          <option value="MOTORCYCLE">Motocicleta</option>
          <option value="BOAT">Embarcación</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="brand">Marca *</Label>
          <CreatableCombobox 
            options={dictionary.map(d => d.brand)}
            value={formData.brand}
            onChange={(val) => handleFieldChange('brand', val)}
            placeholder={isLoadingDictionary ? 'Cargando marcas...' : 'Seleccionar marca o crear...'}
            disabled={isLoadingDictionary}
          />
        </div>
        <div>
          <Label htmlFor="model">Modelo *</Label>
          <CreatableCombobox 
            options={dictionary.find(d => d.brand.toLowerCase() === formData.brand.toLowerCase())?.models || []}
            value={formData.model}
            onChange={(val) => handleFieldChange('model', val)}
            placeholder={!formData.brand ? 'Selecciona una marca primero' : 'Seleccionar modelo o crear...'}
            disabled={!formData.brand || isLoadingDictionary}
          />
        </div>
        <div>
          <Label htmlFor="year">Año</Label>
          <Input id="year" name="year" type="number" value={formData.year} onChange={handleInputChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <Label htmlFor="domain">Patente</Label>
          <Input id="domain" name="domain" placeholder="ej: AB123CD" value={formData.domain} onChange={handleInputChange} />
        </div>
        <div>
          <Label htmlFor="kilometraje">Kilometraje</Label>
          <Input id="kilometraje" name="kilometraje" type="number" placeholder="ej: 45000" value={formData.kilometraje} onChange={handleInputChange} />
        </div>
        <div>
          <Label htmlFor="engineNumber">N° Motor</Label>
          <Input id="engineNumber" name="engineNumber" placeholder="Opcional" value={formData.engineNumber} onChange={handleInputChange} />
        </div>
        <div>
          <Label htmlFor="frameNumber">N° Chasis</Label>
          <Input id="frameNumber" name="frameNumber" placeholder="Opcional" value={formData.frameNumber} onChange={handleInputChange} />
        </div>
      </div>

      {/* Costos de la concesionaria — clave para calcular ganancia real */}
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-amber-800">💰 Costos de la Concesionaria</h3>
          <p className="text-xs text-amber-700 mt-0.5">Precio al que compraste la unidad (no visible al cliente)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="acquisitionCostArs">Costo de Compra (ARS)</Label>
            <Input
              id="acquisitionCostArs"
              name="acquisitionCostArs"
              type="text"
              inputMode="numeric"
              placeholder="ej: 90.000.000"
              value={formData.acquisitionCostArs}
              onChange={handlePriceChange('acquisitionCostArs')}
            />
          </div>
          <div>
            <Label htmlFor="acquisitionCostUsd">Costo de Compra (USD)</Label>
            <Input
              id="acquisitionCostUsd"
              name="acquisitionCostUsd"
              type="text"
              inputMode="numeric"
              placeholder="ej: 90.000"
              value={formData.acquisitionCostUsd}
              onChange={handlePriceChange('acquisitionCostUsd')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="priceUsd">Precio de Venta (USD)</Label>
          <Input
            id="priceUsd"
            name="priceUsd"
            type="text"
            inputMode="numeric"
            placeholder="ej: 95.000"
            value={formData.priceUsd}
            onChange={handlePriceChange('priceUsd')}
          />
        </div>

        <div>
          <Label htmlFor="priceArs">Precio de Venta (ARS)</Label>
          <Input
            id="priceArs"
            name="priceArs"
            type="text"
            inputMode="numeric"
            placeholder="ej: 95.000.000"
            value={formData.priceArs}
            onChange={handlePriceChange('priceArs')}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          name="description"
          placeholder="Descripción detallada del vehículo..."
          value={formData.description}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
        />
      </div>

      <div>
        <Label className="mb-4 block">Imágenes *</Label>
        <ImageUploader onImagesUpload={setImages} maxFiles={5} />
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Unidad'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
