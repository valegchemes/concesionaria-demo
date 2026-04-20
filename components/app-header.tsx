'use client'

import { Bell, LogOut, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { signOut } from 'next-auth/react'

interface AppHeaderProps {
  user: {
    name: string
    email: string
    role: string
  }
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Buscar leads, unidades..."
            className="pl-9 w-full"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
        </button>
        <div className="text-sm text-right">
          <p className="font-medium">{user.name}</p>
          <p className="text-gray-500">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
