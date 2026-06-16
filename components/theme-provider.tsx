'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type BackgroundTheme = 'light' | 'dark' | 'neutral'

interface ThemeContextType {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  computedTheme: BackgroundTheme
  isLoading: boolean
  brightness: number
  updateThemeImage: (imageUrl: string) => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

async function calculateImageBrightness(imageUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(128)
          return
        }

        const maxSize = 100
        const ratio = Math.min(maxSize / img.width, maxSize / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let totalBrightness = 0
        let pixelCount = 0

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b
          totalBrightness += brightness
          pixelCount++
        }

        resolve(Math.round(totalBrightness / pixelCount))
      } catch (error) {
        resolve(128)
      }
    }

    img.onerror = () => resolve(128)
    img.src = imageUrl
  })
}

function getThemeFromBrightness(brightness: number): BackgroundTheme {
  if (brightness < 85) return 'dark'
  if (brightness > 170) return 'light'
  return 'neutral'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('auto')
  const [computedTheme, setComputedTheme] = useState<BackgroundTheme>('neutral')
  const [brightness, setBrightness] = useState<number>(128)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [currentImage, setCurrentImage] = useState<string>('')
  const mountedRef = useRef(true)

  // Initialize mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme-mode') as ThemeMode
    if (saved && ['auto', 'light', 'dark'].includes(saved) && mountedRef.current) {
      setModeState(saved)
    }
    return () => { mountedRef.current = false }
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem('theme-mode', newMode)
  }, [])

  const applyThemeToDOM = useCallback((theme: BackgroundTheme) => {
    document.documentElement.dataset.backgroundTheme = theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Re-calculate or force theme when mode or image changes
  useEffect(() => {
    if (!mountedRef.current) return
    if (mode === 'dark') {
      setComputedTheme('dark')
      applyThemeToDOM('dark')
    } else if (mode === 'light') {
      setComputedTheme('light')
      applyThemeToDOM('light')
    } else {
      // Auto mode: use calculated theme from brightness
      const calcTheme = getThemeFromBrightness(brightness)
      setComputedTheme(calcTheme)
      applyThemeToDOM(calcTheme)
    }
  }, [mode, brightness, applyThemeToDOM])

  const updateThemeImage = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return
    setCurrentImage(imageUrl)

    setIsLoading(true)
    try {
      const calcBrightness = await calculateImageBrightness(imageUrl)
      setBrightness(calcBrightness)
    } catch (error) {
      console.warn('Error calculating brightness:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, setMode, computedTheme, isLoading, brightness, updateThemeImage }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
