/**
 * Hook para detectar el tema del fondo basado en la luminosidad de la imagen
 * Usa un canvas para calcular el brillo promedio de la imagen
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type BackgroundTheme = 'light' | 'dark' | 'neutral'

interface UseBackgroundThemeReturn {
  theme: BackgroundTheme
  isLoading: boolean
  brightness: number // 0-255
  updateTheme: (imageUrl: string) => Promise<void>
}

/**
 * Calcula el brillo promedio de una imagen usando canvas
 */
async function calculateImageBrightness(imageUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(128) // fallback neutral
          return
        }

        // Reducir tamaño para performance
        const maxSize = 100
        const ratio = Math.min(maxSize / img.width, maxSize / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let totalBrightness = 0
        let pixelCount = 0

        // Muestreo: tomar cada 4to pixel para performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Fórmula de luminancia percibida (human eye weighted)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b
          totalBrightness += brightness
          pixelCount++
        }

        const averageBrightness = totalBrightness / pixelCount
        resolve(Math.round(averageBrightness))
      } catch (error) {
        console.warn('Error calculating image brightness:', error)
        resolve(128) // fallback neutral
      }
    }

    img.onerror = () => {
      console.warn('Failed to load image for brightness calculation')
      resolve(128) // fallback neutral
    }

    img.src = imageUrl
  })
}

/**
 * Determina el tema basado en el brillo
 */
function getThemeFromBrightness(brightness: number): BackgroundTheme {
  if (brightness < 85) return 'dark'      // Muy oscuro
  if (brightness > 170) return 'light'    // Muy claro
  return 'neutral'                        // Intermedio
}

export function useBackgroundTheme(initialImageUrl?: string): UseBackgroundThemeReturn {
  const [theme, setTheme] = useState<BackgroundTheme>('neutral')
  const [brightness, setBrightness] = useState<number>(128)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const mountedRef = useRef(true)

  const updateTheme = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return

    setIsLoading(true)
    try {
      const calculatedBrightness = await calculateImageBrightness(imageUrl)
      const calculatedTheme = getThemeFromBrightness(calculatedBrightness)

      setBrightness(calculatedBrightness)
      setTheme(calculatedTheme)

      // Aplicar al DOM para CSS custom props
      document.documentElement.dataset.backgroundTheme = calculatedTheme
      document.documentElement.dataset.backgroundBrightness = calculatedBrightness.toString()

      // Sincronizar Tailwind dark mode:
      // Fondo CLARO (imagen blanca/luminosa) → UI debe ser OSCURA → activar `.dark`
      // Fondo OSCURO o NEUTRAL → UI debe ser CLARA → desactivar `.dark`
      if (calculatedTheme === 'light') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

    } catch (error) {
      console.warn('Error updating background theme:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Inicializar con imagen por defecto si no hay una
  useEffect(() => {
    if (!mountedRef.current) return
    if (initialImageUrl) {
      updateTheme(initialImageUrl)
    } else {
      // Imagen por defecto
      const defaultImage = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'
      updateTheme(defaultImage)
    }
    return () => { mountedRef.current = false }
  }, [initialImageUrl, updateTheme])

  return {
    theme,
    isLoading,
    brightness,
    updateTheme,
  }
}