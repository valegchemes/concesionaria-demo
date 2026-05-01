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
      { name: 'Equipo',           href: '/app/team',              icon: UsersRound, color: 'text-sky-400' },
      { name: 'Costos Mensuales', href: '/app/expenses',          icon: Wallet,     color: 'text-rose-400' },
      { name: 'Configuración',    href: '/app/settings',          icon: Settings,   color: 'text-slate-400' },
      { name: 'Suscripción',      href: '/app/settings/billing',  icon: CreditCard, color: 'text-indigo-400' },
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
    <aside className="flex w-56 flex-col border-r border-white/10 bg-slate-900/70 text-white backdrop-blur-xl">
      {/* Logo / Empresa */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2.5">
          {user.logoUrl ? (
            <Image
              src={user.logoUrl}
              alt={user.companyName}
              width={30}
              height={30}
              className="h-7 w-7 rounded-md bg-white object-contain"
              unoptimized
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/80">
              <Store className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="truncate text-sm font-bold tracking-tight">{user.companyName}</span>
        </div>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentPath.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    {/* Línea izquierda activa */}
                    <span
                      className={cn(
                        'absolute left-0 h-6 w-[3px] rounded-r-full bg-blue-400 transition-all duration-200',
                        isActive ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? item.color : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    <span className="flex-1 truncate">{item.name}</span>
                    {isActive && (
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuario al pie */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-white/20 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[10px] text-slate-400">{roleLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
