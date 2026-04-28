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
    <header className="flex h-16 items-center justify-between border-b border-gray-200/50 bg-white/60 px-6 backdrop-blur-md transition-colors duration-500 dark:border-slate-800/50 dark:bg-slate-950/60">
      <AppHeaderActions />

      <div className="flex items-center gap-3">
        <div className="text-right text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-gray-500">{user.email}</p>
        </div>
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full border object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  )
}
