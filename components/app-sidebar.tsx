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
  ShieldCheck,
  FileText,
  ClipboardList,
  Banknote,
  Mail,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Principal',
    items: [
      { name: 'Dashboard',    href: '/app/dashboard', icon: LayoutDashboard, accent: 'text-blue-400',    dot: 'bg-blue-500' },
      { name: 'Leads',        href: '/app/leads',     icon: Users,           accent: 'text-violet-400',  dot: 'bg-violet-500' },
      { name: 'Unidades',     href: '/app/units',     icon: Car,             accent: 'text-emerald-400', dot: 'bg-emerald-500' },
      { name: 'Operaciones',  href: '/app/deals',     icon: Handshake,       accent: 'text-amber-400',   dot: 'bg-amber-500' },
      { name: 'Gestoría',     href: '/app/gestoria',  icon: ClipboardList,   accent: 'text-yellow-400',  dot: 'bg-yellow-500' },
      { name: 'Documentos',   href: '/app/documents', icon: FileText,        accent: 'text-indigo-400',  dot: 'bg-indigo-500' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { name: 'Equipo',           href: '/app/team',              icon: UsersRound,   accent: 'text-sky-400',    dot: 'bg-sky-500' },
      { name: 'Caja Diaria',      href: '/app/finance',           icon: Banknote,     accent: 'text-emerald-400',dot: 'bg-emerald-500' },
      { name: 'Costos Mensuales', href: '/app/expenses',          icon: Wallet,       accent: 'text-rose-400',   dot: 'bg-rose-500' },
      { name: 'Email con IA',     href: '/app/settings/email-ai', icon: Mail,         accent: 'text-violet-400', dot: 'bg-violet-500' },
      { name: 'Auditoría',        href: '/app/settings/audit',    icon: ShieldCheck,  accent: 'text-indigo-400', dot: 'bg-indigo-500' },
      { name: 'Suscripción',      href: '/app/settings/billing',  icon: CreditCard,   accent: 'text-indigo-400', dot: 'bg-indigo-500' },
      { name: 'Configuración',    href: '/app/settings',          icon: Settings,     accent: 'text-slate-400',  dot: 'bg-slate-500' },
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

  const visibleGroups = navGroups.filter(group => {
    if (group.label === 'Administración' && user.role === 'SELLER') return false
    return true
  })

  return (
    <aside className="sidebar-surface flex w-[220px] flex-col">
      {/* ── Brand / Company ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        {user.logoUrl ? (
          <Image
            src={user.logoUrl}
            alt={user.companyName}
            width={28}
            height={28}
            className="h-7 w-7 rounded-lg bg-white object-cover shadow-sm"
            unoptimized
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-sm">
            <Store className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        <span className="truncate text-[13px] font-semibold tracking-tight text-white/90">
          {user.companyName}
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentPath.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/50 hover:bg-white/10 hover:text-white/85'
                    )}
                  >
                    {/* Active indicator stripe */}
                    {isActive && (
                      <span className="absolute left-0 inset-y-1 w-[3px] rounded-r-full bg-blue-400" />
                    )}
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? item.accent : 'text-white/35 group-hover:text-white/60'
                      )}
                    />
                    <span className="flex-1 truncate">{item.name}</span>
                    {isActive && (
                      <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User Footer ── */}
      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/app/settings"
          prefetch={false}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/10 group"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={32}
              height={32}
              className="h-7 w-7 rounded-full border border-white/20 object-cover shadow-sm"
              unoptimized
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[11px] font-bold text-white shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white/85 group-hover:text-white transition-colors">{user.name}</p>
            <p className="text-[10px] text-white/35">{roleLabel}</p>
          </div>
          <Settings className="h-3.5 w-3.5 text-white/25 group-hover:text-white/50 shrink-0 transition-colors" />
        </Link>
      </div>
    </aside>
  )
}
