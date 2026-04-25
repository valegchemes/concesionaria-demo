'use client'

import { useState, useRef } from 'react'
import { uploadImage, uploadMultipleImages } from '@/lib/blob'
import { X, Upload } from 'lucide-react'
import imageCompression from 'browser-image-compression'

interface ImageUploaderProps {
  onImagesUpload: (urls: string[]) => void
  maxFiles?: number
}

export function ImageUploader({
  onImagesUpload,
  maxFiles = 5,
}: ImageUploaderProps) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || [])
    
    if (files.length === 0) return

    // Validate file count
    if (uploadedImages.length + files.length > maxFiles) {
      setError(`Máximo ${maxFiles} imágenes permitidas`)
      return
    }

    // Validate file types
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} no es una imagen válida`)
        return false
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} es muy grande (máx 20MB)`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    setIsUploading(true)
    setError(null)
    setProgress(0)

    try {
      const options = {
        maxSizeMB: 0.5, // Comprimir hasta ~500KB
        maxWidthOrHeight: 1920, // Resolución max FullHD
        useWebWorker: true,
      }

      // Comprimir todas las imágenes en paralelo
      const compressedFiles = await Promise.all(
        validFiles.map(async (file) => {
          try {
            return await imageCompression(file, options)
          } catch (error) {
            console.error('Error comprimiendo la imagen:', file.name, error)
            return file // Fallback a la original si falla
          }
        })
      )

      const urls = await uploadMultipleImages(compressedFiles, (p) =>
        setProgress(p)
      )

      const newImages = [...uploadedImages, ...urls]
      setUploadedImages(newImages)
      onImagesUpload(newImages)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al subir imágenes'
      )
    } finally {
      setIsUploading(false)
      setProgress(0)
    }
  }

  const removeImage = (url: string) => {
    const newImages = uploadedImages.filter((img) => img !== url)
    setUploadedImages(newImages)
    onImagesUpload(newImages)
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className="cursor-pointer block"
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {isUploading
              ? `Subiendo... ${progress}%`
              : 'Arrastra imágenes aquí o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG, HEIC hasta 20MB (se comprimen automáticamente). Máx {maxFiles} fotos.
          </p>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {uploadedImages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Imágenes subidas ({uploadedImages.length}/{maxFiles})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {uploadedImages.map((url) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                <img
                  src={url}
                  alt="Uploaded"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
