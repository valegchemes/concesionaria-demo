'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/components/image-uploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreateUnitSchema, type UnitType } from '@/lib/shared/validation'

type UnitFormData = {
  type: UnitType | ''
  brand: string
  model: string
  year: number
  priceUsd: string
  priceArs: string
  description: string
}

const initialFormData: UnitFormData = {
  type: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  priceUsd: '',
  priceArs: '',
  description: '',
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const title = `${formData.brand} ${formData.model} ${formData.year}`.trim()
      
      const payload = {
        title,
        type: formData.type,
        priceUsd: formData.priceUsd ? parseFloat(formData.priceUsd) : null,
        priceArs: formData.priceArs ? parseFloat(formData.priceArs) : null,
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
          <Input
            id="brand"
            name="brand"
            placeholder="ej: Toyota"
            value={formData.brand}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="model">Modelo *</Label>
          <Input
            id="model"
            name="model"
            placeholder="ej: Corolla"
            value={formData.model}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="year">Año</Label>
          <Input
            id="year"
            name="year"
            type="number"
            value={formData.year}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <Label htmlFor="priceUsd">Precio (USD) *</Label>
          <Input
            id="priceUsd"
            name="priceUsd"
            type="number"
            step="0.01"
            placeholder="ej: 25000"
            value={formData.priceUsd}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="priceArs">Precio (ARS)</Label>
          <Input
            id="priceArs"
            name="priceArs"
            type="number"
            step="0.01"
            placeholder="ej: 25000000"
            value={formData.priceArs}
            onChange={handleInputChange}
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