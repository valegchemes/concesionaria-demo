'use client'

/**
 * use-staged-photos.ts
 * 
 * Hook para manejar fotos en formularios con staged uploads.
 * 
 * PROBLEMA QUE RESUELVE:
 * Antes, las fotos se subían a Blob Storage inmediatamente al seleccionarlas.
 * Si el usuario subía fotos pero navegaba sin guardar, las fotos quedaban
 * huérfanas en Blob Storage (archivos subidos pero sin referencia en DB).
 * 
 * SOLUCIÓN:
 * - Las fotos nuevas usan createObjectURL para previews locales
 * - La subida a Blob ocurre SOLO cuando el usuario guarda
 * - Los object URLs se limpian automáticamente al cancelar o desmontar
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import imageCompression from 'browser-image-compression'

export interface PhotoItem {
  id: string
  url: string
  order: number
  isNew: boolean
  localUrl?: string
  file?: File
}

export interface UseStagedPhotosOptions {
  initialPhotos?: Array<{ id: string; url: string; order?: number }>
  maxSizeMB?: number
  maxWidthOrHeight?: number
}

export interface UseStagedPhotosReturn {
  photos: PhotoItem[]
  addPhotos: (files: FileList | File[]) => void
  removePhoto: (id: string) => void
  movePhoto: (fromIndex: number, toIndex: number) => void
  clearAll: () => void
  uploadNewPhotos: (onUpload: (files: File[]) => Promise<string[]>) => Promise<void>
  isUploading: boolean
  error: string | null
}

export function useStagedPhotos({
  initialPhotos = [],
  maxSizeMB = 0.5,
  maxWidthOrHeight = 1920,
}: UseStagedPhotosOptions): UseStagedPhotosReturn {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initialPhotos.map((p, idx) => ({
      id: p.id || crypto.randomUUID(),
      url: p.url,
      order: p.order ?? idx,
      isNew: false,
    }))
  )
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const objectUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      objectUrlsRef.current.clear()
    }
  }, [])

  const createLocalUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.add(url)
    return url
  }, [])

  const revokeLocalUrl = useCallback((localUrl: string) => {
    if (objectUrlsRef.current.has(localUrl)) {
      URL.revokeObjectURL(localUrl)
      objectUrlsRef.current.delete(localUrl)
    }
  }, [])

  const addPhotos = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)

    setPhotos((prev) => {
      const existingCount = prev.length
      const newPhotos: PhotoItem[] = fileArray.map((file, idx) => {
        const localUrl = createLocalUrl(file)
        return {
          id: crypto.randomUUID(),
          url: localUrl,
          localUrl,
          file,
          order: existingCount + idx,
          isNew: true,
        }
      })
      return [...prev, ...newPhotos]
    })
  }, [createLocalUrl])

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id)
      if (photo?.isNew && photo.localUrl) {
        revokeLocalUrl(photo.localUrl)
      }
      return prev.filter((p) => p.id !== id)
    })
  }, [revokeLocalUrl])

  const movePhoto = useCallback((fromIndex: number, toIndex: number) => {
    setPhotos((prev) => {
      const newPhotos = [...prev]
      const [moved] = newPhotos.splice(fromIndex, 1)
      newPhotos.splice(toIndex, 0, moved)
      return newPhotos.map((p, idx) => ({ ...p, order: idx }))
    })
  }, [])

  const clearAll = useCallback(() => {
    setPhotos((prev) => {
      prev.forEach((p) => {
        if (p.isNew && p.localUrl) {
          revokeLocalUrl(p.localUrl)
        }
      })
      return []
    })
  }, [revokeLocalUrl])

  const uploadNewPhotos = useCallback(async (
    onUpload: (files: File[]) => Promise<string[]>
  ): Promise<void> => {
    const newPhotos = photos.filter((p) => p.isNew && p.file)

    if (newPhotos.length === 0) {
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const options = {
        maxSizeMB,
        maxWidthOrHeight,
        useWebWorker: true,
      }

      const filesToUpload = newPhotos.map((p) => p.file!)
      const compressedFiles: File[] = []

      for (const file of filesToUpload) {
        try {
          const compressed = await imageCompression(file, options)
          compressedFiles.push(compressed)
        } catch {
          compressedFiles.push(file)
        }
      }

      const blobUrls = await onUpload(compressedFiles)

      setPhotos((prev) => {
        const updated = prev.map((p) => {
          if (p.isNew && p.localUrl) {
            revokeLocalUrl(p.localUrl)
          }
          return p
        })

        for (let i = 0; i < newPhotos.length; i++) {
          const newPhoto = newPhotos[i]
          const idx = updated.findIndex((p) => p.id === newPhoto.id)
          if (idx !== -1 && blobUrls[i]) {
            updated[idx] = {
              ...updated[idx],
              url: blobUrls[i],
              isNew: false,
              localUrl: undefined,
              file: undefined,
            }
          }
        }

        return updated
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error uploading photos'
      setError(message)
      throw err
    } finally {
      setIsUploading(false)
    }
  }, [photos, maxSizeMB, maxWidthOrHeight, revokeLocalUrl])

  return {
    photos,
    addPhotos,
    removePhoto,
    movePhoto,
    clearAll,
    uploadNewPhotos,
    isUploading,
    error,
  }
}