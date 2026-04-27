'use client'

import { memo, useEffect } from 'react'

interface GlobalBackgroundProps {
  avatarUrl?: string
}

function analyzeBrightness(src: string): Promise<'light' | 'dark'> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('light')
        
        // Redimensionar para análisis rápido (evitar lentitud con imgs grandes)
        canvas.width = 100
        canvas.height = (img.height / img.width) * 100
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let r = 0, g = 0, b = 0
        const len = data.length
        const pxCount = len / 4
        
        for (let i = 0; i < len; i += 4) {
          r += data[i]
          g += data[i+1]
          b += data[i+2]
        }
        
        const luminance = (0.299 * (r / pxCount) + 0.587 * (g / pxCount) + 0.114 * (b / pxCount))
        // Si el brillo es menor a 130, se considera oscura
        resolve(luminance < 130 ? 'dark' : 'light')
      } catch (e) {
        console.warn('Canvas fallback', e)
        resolve('light')
      }
    }
    img.onerror = () => resolve('light')
    img.src = src
  })
}

export const GlobalBackground = memo(function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  // Si no hay avatar, usamos una imagen abstracta por defecto para que se aprecie el efecto translúcido
  const bgImage = avatarUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

  useEffect(() => {
    let active = true
    analyzeBrightness(bgImage).then(theme => {
      if (!active) return
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    })
    return () => { active = false }
  }, [bgImage])

  return (
    <>
      {/* 
        Contenedor fijo en el fondo (z-index negativo)
        Se utiliza la imagen de perfil como fondo repetible o de cobertura
      */}
      <div 
        className="fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${bgImage})`,
          // Ajusta el zoom ligeramente para dar mejor aspecto de fondo
          transform: 'scale(1.05)'
        }}
      />
      
      {/* 
        Capa de desenfoque y opacidad (overlay)
        Asegura que el texto y los paneles superpuestos sean perfectamente legibles
      */}
      <div className="fixed inset-0 z-[-9] bg-white/40 dark:bg-slate-950/60 backdrop-blur-sm transition-colors duration-500" />
    </>
  )
})
