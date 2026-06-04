import Image from 'next/image'
import { AppHeaderActions } from './app-header-actions'

interface AppHeaderProps {
  user: {
    name: string
    email: string
    role: string
    avatarUrl?: string
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  const roleLabel =
    user.role === 'ADMIN' ? 'Administrador' :
    user.role === 'MANAGER' ? 'Manager' : 'Vendedor'

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between
                        border-b border-adaptive surface-primary px-5
                        backdrop-blur-xl transition-colors duration-300">
      {/* Left: breadcrumb / search / quick actions */}
      <AppHeaderActions />

      {/* Right: user info */}
      <div className="flex items-center gap-3 ml-4">
        <div className="hidden sm:flex flex-col items-end leading-none">
          <span className="text-[13px] font-semibold text-adaptive-primary">{user.name}</span>
          <span className="text-[10px] text-adaptive-secondary mt-0.5">{roleLabel}</span>
        </div>
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name}
            width={34}
            height={34}
            className="h-8 w-8 rounded-full border border-adaptive object-cover shadow-sm"
            unoptimized
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full
                          bg-gradient-to-br from-blue-500 to-violet-600
                          text-[12px] font-bold text-white shadow-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  )
}
