'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X, Upload } from 'lucide-react'

const unitTypes = [
  { value: 'CAR', label: 'Auto' },
  { value: 'MOTORCYCLE', label: 'Moto' },
  { value: 'BOAT', label: 'Lancha' },
]

const statuses = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'IN_PREP', label: 'En preparación' },
  { value: 'RESERVED', label: 'Reservado' },
  { value: 'SOLD', label: 'Vendido' },
]

export default function NewUnitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'CAR',
    title: '',
    description: '',
    status: 'AVAILABLE',
    location: '',
    priceArs: '',
    priceUsd: '',
    vin: '',
    domain: '',
    engineNumber: '',
    frameNumber: '',
    hin: '',
    registrationNumber: '',
    tags: '',
  })
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const remainingSlots = 5 - photos.length
    const filesToProcess = Array.from(files).slice(0, remainingSlots)

    const promises = filesToProcess.map(file => {
      return new Promise<string>((resolve, reject) => {
        if (file.size > 2 * 1024 * 1024) {
          reject(new Error(`La imagen ${file.name} es muy grande (máx 2MB)`))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error(`Error al leer ${file.name}`))
        reader.readAsDataURL(file)
      })
    })

    Promise.all(promises)
      .then(newPhotos => {
        setPhotos(prev => [...prev, ...newPhotos])
      })
      .catch(err => {
        alert(err.message)
      })
      .finally(() => {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      const photoObjects = photos.map((url, index) => ({ url, order: index }))

      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceArs: formData.priceArs ? parseFloat(formData.priceArs) : undefined,
          priceUsd: formData.priceUsd ? parseFloat(formData.priceUsd) : undefined,
          tags,
          photos: photoObjects,
        }),
      })

      if (res.ok) {
        router.push('/app/units')
      } else {
        const errorData = await res.json()
        let errorMessage = 'Error al guardar la unidad.'
        
        if (errorData.error === 'Validation failed' && errorData.details) {
          errorMessage = 'Errores de validación:\n' + Object.entries(errorData.details)
            .map(([field, errors]) => `- ${field}: ${(errors as string[]).join(', ')}`)
            .join('\n')
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
        
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Error creating unit:', error)
      alert('Error de conexión al servidor.')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nueva Unidad</h1>

      <form onSubmit={onSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => updateField('type', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border"
                  >
                    {unitTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border"
                  >
                    {statuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Ej: Toyota Corolla 2020 XLi"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border"
                  placeholder="Detalles del vehículo..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Ej: Buenos Aires"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceArs">Precio ARS</Label>
                  <Input
                    id="priceArs"
                    type="number"
                    value={formData.priceArs}
                    onChange={(e) => updateField('priceArs', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceUsd">Precio USD</Label>
                  <Input
                    id="priceUsd"
                    type="number"
                    value={formData.priceUsd}
                    onChange={(e) => updateField('priceUsd', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.type === 'CAR' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vin">VIN</Label>
                    <Input
                      id="vin"
                      value={formData.vin}
                      onChange={(e) => updateField('vin', e.target.value)}
                      placeholder="Número de chasis"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Patente</Label>
                    <Input
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => updateField('domain', e.target.value)}
                      placeholder="ABC123"
                    />
                  </div>
                </div>
              )}

              {formData.type === 'MOTORCYCLE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="engineNumber">N° Motor</Label>
                    <Input
                      id="engineNumber"
                      value={formData.engineNumber}
                      onChange={(e) => updateField('engineNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frameNumber">N° Cuadro</Label>
                    <Input
                      id="frameNumber"
                      value={formData.frameNumber}
                      onChange={(e) => updateField('frameNumber', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {formData.type === 'BOAT' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hin">HIN</Label>
                    <Input
                      id="hin"
                      value={formData.hin}
                      onChange={(e) => updateField('hin', e.target.value)}
                      placeholder="Hull Identification Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Matrícula</Label>
                    <Input
                      id="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={(e) => updateField('registrationNumber', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fotos (máximo 5)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={photos.length >= 5 || uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photos.length >= 5 || uploading}
                  className="w-full h-32 border-dashed"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploading ? 'Subiendo...' : 'Click para seleccionar fotos'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {photos.length}/5 fotos - Máx 2MB cada una
                    </span>
                  </div>
                </Button>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, index) => (
                    <div key={index} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Otros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separados por coma)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  placeholder="automatico, nafta, impecable"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Unidad'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
