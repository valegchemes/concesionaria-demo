'use client'

import { memo } from 'react'

interface GlobalBackgroundProps {
  avatarUrl?: string
}

export const GlobalBackground = memo(function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  // Si no hay avatar, usamos una imagen abstracta por defecto para que se aprecie el efecto translúcido
  const bgImage = avatarUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

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
      <div className="fixed inset-0 z-[-9] bg-white/80 backdrop-blur-md" />
    </>
  )
})
