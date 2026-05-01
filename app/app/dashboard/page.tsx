import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Car, Handshake, TrendingUp, AlertCircle, Clock,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { AnalyticsDashboardLazy } from '@/components/dashboard/analytics-dashboard-lazy'

async function getDashboardData(companyId: string) {
  const [
    totalLeads, activeLeads, newLeads, lostLeads,
    totalUnits, availableUnits, soldUnits,
    activeDeals, completedDeals, canceledDeals,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({ where: { companyId, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } } }),
    prisma.lead.count({ where: { companyId, status: 'NEW' } }),
    prisma.lead.count({ where: { companyId, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId, isActive: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'SOLD' } }),
    prisma.deal.count({ where: { companyId, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } } }),
    prisma.deal.count({ where: { companyId, status: 'DELIVERED' } }),
    prisma.deal.count({ where: { companyId, status: 'CANCELED' } }),
  ])

  return {
    leads: { total: totalLeads, active: activeLeads, new: newLeads, lost: lostLeads },
    units: { total: totalUnits, available: availableUnits, sold: soldUnits },
    deals: { active: activeDeals, completed: completedDeals, canceled: canceledDeals },
  }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

interface KpiCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
  iconColor: string
  trend?: { value: number; label: string }
}

function KpiCard({ title, value, subtitle, icon: Icon, accentColor, iconColor, trend }: KpiCardProps) {
  return (
    <Card className={`relative overflow-hidden border-l-4 ${accentColor} bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30 hover:shadow-lg hover:shadow-black/10 transition-all duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-black text-foreground tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value > 0 ? 'text-emerald-600' : trend.value < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {trend.value > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend.value < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatPillProps {
  label: string
  value: number
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red'
}

function StatPill({ label, value, sublabel, icon: Icon, color }: StatPillProps) {
  const colorMap = {
    blue: {
      card: 'border-blue-100/50 bg-blue-50/40 dark:border-blue-900/30 dark:bg-blue-950/30',
      label: 'text-blue-700 dark:text-blue-300',
      value: 'text-blue-800 dark:text-blue-100',
      sub: 'text-blue-600/70 dark:text-blue-400/70',
      icon: 'text-blue-300 dark:text-blue-600',
    },
    green: {
      card: 'border-emerald-100/50 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/30',
      label: 'text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-800 dark:text-emerald-100',
      sub: 'text-emerald-600/70 dark:text-emerald-400/70',
      icon: 'text-emerald-300 dark:text-emerald-600',
    },
    red: {
      card: 'border-red-100/50 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/30',
      label: 'text-red-700 dark:text-red-300',
      value: 'text-red-800 dark:text-red-100',
      sub: 'text-red-600/70 dark:text-red-400/70',
      icon: 'text-red-300 dark:text-red-600',
    },
  }
  const c = colorMap[color]

  return (
    <Card className={`${c.card} backdrop-blur-sm border`}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${c.label}`}>{label}</p>
            <p className={`mt-1 text-3xl font-black ${c.value}`}>{formatNumber(value)}</p>
            <p className={`mt-0.5 text-xs ${c.sub}`}>{sublabel}</p>
          </div>
          <Icon className={`h-10 w-10 ${c.icon}`} />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.companyId) {
    redirect('/login')
  }

  let stats = {
    leads: { total: 0, active: 0, new: 0, lost: 0 },
    units: { total: 0, available: 0, sold: 0 },
    deals: { active: 0, completed: 0, canceled: 0 },
  }

  let companyName: string | undefined

  try {
    const [data, company] = await Promise.all([
      getDashboardData(session.user.companyId),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true },
      }),
    ])
    stats = data
    companyName = company?.name
  } catch (e) {
    console.error('[Dashboard] DB error:', e)
  }

  const conversionRate =
    stats.leads.total > 0
      ? Math.min(100, (stats.deals.completed / stats.leads.total) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
        {companyName && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{companyName}</p>
        )}
      </div>

      {/* Resumen Operacional */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
          Resumen Operacional
        </h2>

        {/* KPI Cards con borde de color */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Leads Activos"
            value={formatNumber(stats.leads.active)}
            subtitle={`de ${formatNumber(stats.leads.total)} total`}
            icon={Users}
            accentColor="border-l-blue-500"
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
          />
          <KpiCard
            title="Leads Nuevos"
            value={formatNumber(stats.leads.new)}
            subtitle="sin contactar"
            icon={AlertCircle}
            accentColor="border-l-orange-500"
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400"
          />
          <KpiCard
            title="Unidades Disponibles"
            value={formatNumber(stats.units.available)}
            subtitle={`${formatNumber(stats.deals.completed)} vendidas · ${formatNumber(stats.units.total)} total`}
            icon={Car}
            accentColor="border-l-emerald-500"
            iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          />
          <KpiCard
            title="Tasa de Conversión"
            value={`${conversionRate}%`}
            subtitle="leads → ventas cerradas"
            icon={TrendingUp}
            accentColor="border-l-violet-500"
            iconColor="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
          />
        </div>

        {/* Pills de operaciones */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatPill
            label="En Curso"
            value={stats.deals.active}
            sublabel="negociaciones activas"
            icon={Clock}
            color="blue"
          />
          <StatPill
            label="Completadas"
            value={stats.deals.completed}
            sublabel="operaciones entregadas"
            icon={CheckCircle}
            color="green"
          />
          <StatPill
            label="Canceladas"
            value={stats.deals.canceled}
            sublabel="operaciones canceladas"
            icon={XCircle}
            color="red"
          />
        </div>
      </div>

      {/* Analytics de Ventas */}
      <div className="border-t border-white/20 dark:border-slate-800/50 pt-4">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
          Analíticas de Ventas
        </h2>
        {stats.deals.completed > 0 ? (
          <AnalyticsDashboardLazy
            companyId={session.user.companyId}
            companyName={companyName}
            hideHeader
          />
        ) : (
          <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/30">
            <CardContent className="py-12 text-center text-gray-400 dark:text-gray-300">
              <Handshake className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p className="font-semibold text-gray-500 dark:text-gray-200">Sin ventas completadas aún</p>
              <p className="mt-1 text-sm">
                Los gráficos aparecerán cuando marques tu primera operación como <strong>Entregada</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
