'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Car,
  Handshake,
  Settings,
  Store,
  CreditCard,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/app/leads', icon: Users },
  { name: 'Unidades', href: '/app/units', icon: Car },
  { name: 'Operaciones', href: '/app/deals', icon: Handshake },
  { name: 'Equipo', href: '/app/team', icon: UsersRound },
  { name: 'Costos Mensuales', href: '/app/expenses', icon: Wallet },
  { name: 'Configuración', href: '/app/settings', icon: Settings },
  { name: 'Suscripción', href: '/app/settings/billing', icon: CreditCard },
]

interface AppSidebarProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    companyName: string
    companySlug: string
    avatarUrl?: string
    logoUrl?: string
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-slate-900/60 transition-colors duration-500 backdrop-blur-xl text-white flex flex-col border-r border-slate-800/50">
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          {user.logoUrl ? (
            <img src={user.logoUrl} alt={user.companyName} className="h-8 w-8 rounded-md object-contain bg-white" />
          ) : (
            <Store className="h-6 w-6 text-blue-400" />
          )}
          <span className="font-bold text-lg truncate">{user.companyName}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full object-cover border border-slate-700" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-300">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400">{user.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
