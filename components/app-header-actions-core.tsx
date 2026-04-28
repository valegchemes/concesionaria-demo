'use client'

import { Bell, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { GlobalSearch } from './global-search'

export function AppHeaderActionsCore() {
  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 text-gray-500 transition-colors hover:text-red-600"
          title="Cerrar sesion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
