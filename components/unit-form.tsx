'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreateUnitSchema, type UnitType } from '@/lib/shared/validation'

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

  const [formData, setFormData] = useState<UnitFormData>(initialFormData)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || prev.year : value,
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
        domain: formData.brand.toLowerCase(),
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

      const data = await response.json()
      
      setFormData(initialFormData)
      setImages([])

      router.push(`/app/units/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Agregar Nueva Unidad
        </h2>
        <p className="text-sm text-gray-700">
          Complete el formulario para agregar una nueva unidad a tu catálogo
        </p>
      </div>

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
          <Input id="brand" name="brand" placeholder="ej: Toyota" value={formData.brand} onChange={handleInputChange} required />
        </div>
        <div>
          <Label htmlFor="model">Modelo *</Label>
          <Input id="model" name="model" placeholder="ej: Corolla" value={formData.model} onChange={handleInputChange} required />
        </div>
        <div>
          <Label htmlFor="year">Año</Label>
          <Input id="year" name="year" type="number" value={formData.year} onChange={handleInputChange} />
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
