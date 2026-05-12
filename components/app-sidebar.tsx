'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Principal',
    items: [
      { name: 'Dashboard',    href: '/app/dashboard', icon: LayoutDashboard, color: 'text-blue-400' },
      { name: 'Leads',        href: '/app/leads',     icon: Users,           color: 'text-violet-400' },
      { name: 'Unidades',     href: '/app/units',     icon: Car,             color: 'text-emerald-400' },
      { name: 'Operaciones',  href: '/app/deals',     icon: Handshake,       color: 'text-amber-400' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { name: 'Equipo',           href: '/app/team',              icon: UsersRound,   color: 'text-sky-400' },
      { name: 'Costos Mensuales', href: '/app/expenses',          icon: Wallet,       color: 'text-rose-400' },
      { name: 'Configuración',    href: '/app/settings',          icon: Settings,     color: 'text-slate-400' },
      { name: 'Auditoría',        href: '/app/settings/audit',    icon: ShieldCheck,  color: 'text-indigo-400' },
      { name: 'Suscripción',      href: '/app/settings/billing',  icon: CreditCard,   color: 'text-indigo-400' },
    ],
  },
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
  const currentPath = usePathname() || '/app'

  const roleLabel =
    user.role === 'ADMIN' ? 'Administrador' :
    user.role === 'MANAGER' ? 'Manager' : 'Vendedor'

  return (
    <aside className="flex w-64 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-r border-slate-800/50">
      {/* Logo / Empresa */}
      <div className="border-b border-slate-800/50 px-6 py-5">
        <div className="flex items-center gap-3">
          {user.logoUrl ? (
            <Image
              src={user.logoUrl}
              alt={user.companyName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg bg-white object-cover shadow-lg"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
              <Store className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="flex-1">
            <span className="truncate text-sm font-bold tracking-tight text-white">{user.companyName}</span>
            <p className="text-xs text-slate-400 mt-0.5">Panel de Control</p>
          </div>
        </div>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {navGroups
          .filter(group => {
            if (group.label === 'Administración' && user.role === 'SELLER') return false
            return true
          })
          .map((group) => (
          <div key={group.label}>
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = currentPath.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white/10 text-white shadow-md'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    {/* Indicador izquierdo activo */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-blue-400 to-blue-500" />
                    )}
                    <item.icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors',
                        isActive ? item.color : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    <span className="flex-1 truncate">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuario al pie */}
      <div className="border-t border-slate-800/50 px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-slate-700 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-slate-400">{roleLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
