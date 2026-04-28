import Link from 'next/link'
import Image from 'next/image'
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
  { name: 'Configuracion', href: '/app/settings', icon: Settings },
  { name: 'Suscripcion', href: '/app/settings/billing', icon: CreditCard },
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
  currentPath: string
}

export function AppSidebar({ user, currentPath }: AppSidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-slate-800/50 bg-slate-900/60 text-white backdrop-blur-xl transition-colors duration-500">
      <div className="border-b border-slate-800/50 p-4">
        <div className="flex items-center gap-2">
          {user.logoUrl ? (
            <Image
              src={user.logoUrl}
              alt={user.companyName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-md bg-white object-contain"
              unoptimized
            />
          ) : (
            <Store className="h-6 w-6 text-blue-400" />
          )}
          <span className="truncate text-lg font-bold">{user.companyName}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = currentPath.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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

      <div className="border-t border-slate-800/50 p-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-slate-700 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
              <span className="text-sm font-medium text-slate-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="overflow-hidden">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-slate-400">
              {user.role === 'ADMIN' ? 'Administrador' : user.role === 'MANAGER' ? 'Manager' : 'Vendedor'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
