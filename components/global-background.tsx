interface GlobalBackgroundProps {
  avatarUrl?: string
}

const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop'

export function GlobalBackground({ avatarUrl }: GlobalBackgroundProps) {
  const bgImage = avatarUrl || DEFAULT_BACKGROUND

  return (
    <>
      <div
        className="fixed inset-0 z-[-10] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImage})`,
          transform: 'scale(1.05)',
        }}
      />
      <div className="fixed inset-0 z-[-9] bg-white/55 backdrop-blur-sm transition-colors duration-500 dark:bg-slate-950/70" />
    </>
  )
}
