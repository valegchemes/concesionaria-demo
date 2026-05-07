/**
 * Fondo global adaptativo con detección automática de tema
 * Ajusta las superficies según la luminosidad del fondo
 */

'use client'

import { useEffect } from 'react'
import { useBackgroundTheme } from '@/lib/hooks/use-background-theme'

interface GlobalBackgroundProps {
  avatarUrl?: string
}

const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

export function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  const { updateTheme, theme } = useBackgroundTheme()
  const bgImage = avatarUrl || DEFAULT_BACKGROUND

  // Actualizar tema cuando cambia la imagen
  useEffect(() => {
    updateTheme(bgImage)
  }, [bgImage, updateTheme])

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

      {/* Overlay adaptativo basado en el tema detectado */}
      <div
        className={`
          fixed inset-0 z-[-9] backdrop-blur-[6px] transition-all duration-500
          ${theme === 'dark'
            ? 'bg-gradient-to-br from-white/65 via-white/50 to-slate-100/60'
            : theme === 'light'
            ? 'bg-gradient-to-br from-slate-950/80 via-slate-950/70 to-slate-900/75'
            : 'bg-gradient-to-br from-slate-600/40 via-slate-500/35 to-slate-400/45'
          }
        `}
      />

      {/* Vignette sutil para profundidad — adaptativa */}
      <div
        className={`
          fixed inset-0 z-[-8] transition-all duration-500
          ${theme === 'dark'
            ? 'bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.08)_100%)]'
            : theme === 'light'
            ? 'bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(255,255,255,0.06)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.05)_100%)]'
          }
        `}
      />
    </>
  )
}
