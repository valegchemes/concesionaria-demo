interface GlobalBackgroundProps {
  avatarUrl?: string
}

const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

export function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  const bgImage = avatarUrl || DEFAULT_BACKGROUND

  return (
    <>
      {/* Imagen de fondo — escalada para evitar bordes en blur */}
      <div
        className="fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImage})`,
          transform: 'scale(1.08)',
        }}
      />
      {/* Overlay premium: gradiente oscuro desde abajo + blur más fuerte */}
      <div className="fixed inset-0 z-[-9] bg-gradient-to-br from-white/65 via-white/50 to-slate-100/60 backdrop-blur-[6px] transition-colors duration-500 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-slate-900/75" />
      {/* Vignette sutil para profundidad */}
      <div className="fixed inset-0 z-[-8] bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.12)_100%)]" />
    </>
  )
}
