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
  return (
    <header className="relative z-40 flex h-14 items-center justify-between bg-white border-b border-slate-200 px-6 shadow-sm transition-all duration-300">
      <div className="flex-1">
        <AppHeaderActions />
      </div>

      <div className="ml-6 flex items-center gap-4">
        {/* Badge de notificación */}
        <div className="relative">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500"></span>
          </button>
        </div>

        {/* Separador */}
        <div className="w-px h-6 bg-slate-200"></div>

        {/* Perfil del usuario */}
        <div className="flex items-center gap-3">
          <div className="text-right text-sm hidden sm:block">
            <p className="font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 font-bold text-white text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
