/**
 * Fondo global adaptativo con detección automática de tema
 * Ajusta las superficies según la luminosidad del fondo
 */

'use client'

import { useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'

interface GlobalBackgroundProps {
  avatarUrl?: string
}

const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

export function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  const { updateThemeImage, computedTheme } = useTheme()
  const bgImage = avatarUrl || DEFAULT_BACKGROUND

  // Actualizar la imagen en el provider para cálculo en modo auto
  useEffect(() => {
    updateThemeImage(bgImage)
  }, [bgImage, updateThemeImage])

  return (
    <>
      {/* Imagen de fondo — escalada para evitar bordes en blur */}
      <div
        className="fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `url(${bgImage})`,
          transform: 'scale(1.08)',
        }}
      />

      {/* Overlay adaptativo asegurando legibilidad 100% */}
      <div
        className={`
          fixed inset-0 z-[-9] backdrop-blur-[8px] transition-all duration-500
          ${computedTheme === 'dark'
            ? 'bg-gradient-to-br from-slate-950/85 via-slate-900/80 to-slate-950/90' // Fondo oscuro estricto para modo oscuro
            : computedTheme === 'light'
            ? 'bg-gradient-to-br from-white/85 via-white/80 to-slate-50/90' // Fondo claro estricto para modo claro
            : 'bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-950/70' // Neutral
          }
        `}
      />

      {/* Vignette sutil para profundidad */}
      <div
        className={`
          fixed inset-0 z-[-8] transition-all duration-500
          ${computedTheme === 'dark'
            ? 'bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_100%)]'
            : computedTheme === 'light'
            ? 'bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(255,255,255,0.4)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.3)_100%)]'
          }
        `}
      />
    </>
  )
}
