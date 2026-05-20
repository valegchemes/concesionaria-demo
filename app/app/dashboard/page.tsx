import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Car, Handshake, TrendingUp, AlertCircle, Clock,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Minus, Lock,
  Banknote, Receipt, TriangleAlert,
} from 'lucide-react'
import { AnalyticsDashboardLazy } from '@/components/dashboard/analytics-dashboard-lazy'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import Link from 'next/link'

async function getDashboardData(companyId: string, userId: string, role: string) {
  const isSeller = role === 'SELLER'
  const leadWhere = isSeller ? { companyId, assignedToId: userId } : { companyId }
  const dealWhere = isSeller ? { companyId, sellerId: userId } : { companyId }

  const [
    totalLeads, activeLeads, newLeads, lostLeads,
    totalUnits, availableUnits, soldUnits,
    activeDeals, completedDeals, canceledDeals,
    paidInstallmentsThisMonth, pendingInstallments, overdueInstallments,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'NEW' } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId, isActive: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'SOLD' } }),
    prisma.deal.count({ where: { ...dealWhere, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'DELIVERED' } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'CANCELED' } }),
    // Pagos de cuotas realizados en los últimos 30 días
    prisma.installmentPayment.findMany({
      where: {
        installment: { promissoryNote: { companyId } },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { amount: true },
    }),
    // Cuotas pendientes totales
    prisma.installment.findMany({
      where: { status: 'PENDING', promissoryNote: { companyId } },
      select: { amount: true },
    }),
    // Cuotas vencidas totales
    prisma.installment.findMany({
      where: { status: 'OVERDUE', promissoryNote: { companyId } },
      select: { amount: true },
    }),
  ])

  const collectedArs = paidInstallmentsThisMonth.reduce((sum: number, p: { amount: { toString: () => string } }) => sum + Number(p.amount.toString()), 0)
  const pendingArs = pendingInstallments.reduce((sum: number, i: { amount: { toString: () => string } }) => sum + Number(i.amount.toString()), 0)
  const overdueArs = overdueInstallments.reduce((sum: number, i: { amount: { toString: () => string } }) => sum + Number(i.amount.toString()), 0)

  let commissionArs = 0
  let commissionUsd = 0
  let pendingCommissionArs = 0
  let pendingCommissionUsd = 0
  let commissionRate = 0

  if (isSeller) {
    const sellerInfo = await prisma.user.findUnique({
      where: { id: userId },
      select: { commissionRate: true }
    })
    if (sellerInfo) {
      commissionRate = Number(sellerInfo.commissionRate || 0)
    }

    const sellerDeals = await prisma.deal.findMany({
      where: {
        ...dealWhere,
        status: { in: ['DELIVERED', 'NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] }
      },
      select: {
        status: true,
        finalPrice: true,
        finalPriceCurrency: true,
        commissionValue: true
      }
    })

    for (const d of sellerDeals) {
      const finalPrice = Number(d.finalPrice)
      let comm = Number(d.commissionValue || 0)
      if (comm === 0 && commissionRate > 0) {
        comm = finalPrice * (commissionRate / 100)
      }
      
      if (d.status === 'DELIVERED') {
        if (d.finalPriceCurrency === 'USD') {
          commissionUsd += comm
        } else {
          commissionArs += comm
        }
      } else {
        if (d.finalPriceCurrency === 'USD') {
          pendingCommissionUsd += comm
        } else {
          pendingCommissionArs += comm
        }
      }
    }
  }

  return {
    leads: { total: totalLeads, active: activeLeads, new: newLeads, lost: lostLeads },
    units: { total: totalUnits, available: availableUnits, sold: soldUnits },
    deals: { active: activeDeals, completed: completedDeals, canceled: canceledDeals },
    notes: { collectedArs, pendingArs, overdueArs },
    sellerCommission: isSeller ? {
      commissionRate,
      commissionArs,
      commissionUsd,
      pendingCommissionArs,
      pendingCommissionUsd
    } : null
  }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

function formatArs(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${formatNumber(Math.round(n))}`
}

function formatCurrency(n: number, currency: string) {
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n)
  return currency === 'USD' ? `$${formatted} USD` : `$${formatted} ARS`
}

interface KpiCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
  iconColor: string
  trend?: { value: number; label: string }
  href?: string
}

function KpiCard({ title, value, subtitle, icon: Icon, accentColor, iconColor, trend, href }: KpiCardProps) {
  const card = (
    <Card className={`relative overflow-hidden border-l-4 ${accentColor} surface-secondary hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group ${href ? 'cursor-pointer' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-adaptive-secondary">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor} transition-transform group-hover:scale-110`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-black text-adaptive-primary tabular-nums">{value}</div>
        <p className="text-xs text-adaptive-secondary mt-0.5">{subtitle}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value > 0 ? 'text-emerald-500' : trend.value < 0 ? 'text-red-500' : 'text-adaptive-secondary'}`}>
            {trend.value > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend.value < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href} className="block">{card}</Link>
  }
  return card
}

interface StatPillProps {
  label: string
  value: number
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red'
  href?: string
}

function StatPill({ label, value, sublabel, icon: Icon, color, href }: StatPillProps) {
  const colorMap = {
    blue: {
      label: 'text-blue-500 dark:text-blue-400',
      icon: 'text-blue-400',
    },
    green: {
      label: 'text-emerald-500 dark:text-emerald-400',
      icon: 'text-emerald-400',
    },
    red: {
      label: 'text-red-500 dark:text-red-400',
      icon: 'text-red-400',
    },
  }
  const c = colorMap[color]

  const card = (
    <Card className={`surface-secondary hover:-translate-y-1 transition-transform duration-300 group ${href ? 'cursor-pointer' : ''}`}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${c.label}`}>{label}</p>
            <p className={`mt-1 text-3xl font-black text-adaptive-primary`}>{formatNumber(value)}</p>
            <p className={`mt-0.5 text-xs text-adaptive-secondary`}>{sublabel}</p>
          </div>
          <Icon className={`h-10 w-10 ${c.icon} transition-transform group-hover:scale-110`} />
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href} className="block">{card}</Link>
  }
  return card
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.companyId) {
    redirect('/login')
  }

  let stats: {
    leads: { total: number; active: number; new: number; lost: number }
    units: { total: number; available: number; sold: number }
    deals: { active: number; completed: number; canceled: number }
    notes: { collectedArs: number; pendingArs: number; overdueArs: number }
    sellerCommission: {
      commissionRate: number
      commissionArs: number
      commissionUsd: number
      pendingCommissionArs: number
      pendingCommissionUsd: number
    } | null
  } = {
    leads: { total: 0, active: 0, new: 0, lost: 0 },
    units: { total: 0, available: 0, sold: 0 },
    deals: { active: 0, completed: 0, canceled: 0 },
    notes: { collectedArs: 0, pendingArs: 0, overdueArs: 0 },
    sellerCommission: null
  }

  let companyName: string | undefined
  let analyticsEnabled = false
  let userRole = session.user.role

  try {
    // Fetch user from DB to prevent stale session role issues
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    if (dbUser) {
      userRole = dbUser.role
    }

    const [data, company, planLimits] = await Promise.all([
      getDashboardData(session.user.companyId, session.user.id, userRole),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true },
      }),
      getPlanLimits(session.user.companyId),
    ])
    stats = data
    companyName = company?.name
    analyticsEnabled = planLimits.analyticsEnabled
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
        <h1 className="text-2xl font-black text-adaptive-primary tracking-tight">Dashboard</h1>
        {companyName && (
          <p className="mt-0.5 text-sm text-adaptive-secondary">{companyName}</p>
        )}
      </div>

      {/* Mis Comisiones (Solo para Vendedores) */}
      {stats.sellerCommission && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-adaptive-secondary">
              Mis Ganancias y Comisiones
            </h2>
            <span className="w-fit inline-flex items-center rounded-full bg-violet-500/10 dark:bg-violet-950/40 border border-violet-200/20 dark:border-violet-800/40 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              Comisión Asignada: {stats.sellerCommission.commissionRate}%
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Comisiones Ganadas */}
            <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 surface-secondary hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-adaptive-secondary">
                  Ganancias Acumuladas
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 transition-transform group-hover:scale-110">
                  <Receipt className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(stats.sellerCommission.commissionArs, 'ARS')}
                  </p>
                  {stats.sellerCommission.commissionUsd > 0 && (
                    <p className="text-lg font-bold text-emerald-500/90 dark:text-emerald-350">
                      {formatCurrency(stats.sellerCommission.commissionUsd, 'USD')}
                    </p>
                  )}
                  <p className="text-xs text-adaptive-secondary mt-1">
                    Comisiones por las {stats.deals.completed} ventas entregadas.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Comisiones Proyectadas */}
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500 surface-secondary hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-adaptive-secondary">
                  Comisiones en Proceso
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 transition-transform group-hover:scale-110">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(stats.sellerCommission.pendingCommissionArs, 'ARS')}
                  </p>
                  {stats.sellerCommission.pendingCommissionUsd > 0 && (
                    <p className="text-lg font-bold text-blue-500/90 dark:text-blue-350">
                      {formatCurrency(stats.sellerCommission.pendingCommissionUsd, 'USD')}
                    </p>
                  )}
                  <p className="text-xs text-adaptive-secondary mt-1">
                    Estimado de {stats.deals.active} operaciones activas en curso.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Resumen Operacional */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-adaptive-secondary">
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
            href="/app/leads?filter=ACTIVE"
          />
          <KpiCard
            title="Leads Nuevos"
            value={formatNumber(stats.leads.new)}
            subtitle="sin contactar"
            icon={AlertCircle}
            accentColor="border-l-orange-500"
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400"
            href="/app/leads?filter=NEW"
          />
          <KpiCard
            title="Unidades Disponibles"
            value={formatNumber(stats.units.available)}
            subtitle={`${formatNumber(stats.deals.completed)} vendidas · ${formatNumber(stats.units.total)} total`}
            icon={Car}
            accentColor="border-l-emerald-500"
            iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            href="/app/units?status=AVAILABLE"
          />
          <KpiCard
            title="Tasa de Conversión"
            value={`${conversionRate}%`}
            subtitle="leads → ventas cerradas"
            icon={TrendingUp}
            accentColor="border-l-violet-500"
            iconColor="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
            href="/app/deals?status=DELIVERED"
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
            href="/app/deals?status=ACTIVE"
          />
          <StatPill
            label="Completadas"
            value={stats.deals.completed}
            sublabel="operaciones entregadas"
            icon={CheckCircle}
            color="green"
            href="/app/deals?status=DELIVERED"
          />
          <StatPill
            label="Canceladas"
            value={stats.deals.canceled}
            sublabel="operaciones canceladas"
            icon={XCircle}
            color="red"
            href="/app/deals?status=CANCELED"
          />
        </div>
      </div>

      {/* Resumen de Pagarés */}
      {(stats.notes.collectedArs > 0 || stats.notes.pendingArs > 0 || stats.notes.overdueArs > 0) && (
        <div className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-adaptive-secondary">
            Resumen de Pagarés (últimos 30 días)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              title="Cobrado en Cuotas"
              value={formatArs(stats.notes.collectedArs)}
              subtitle="pagos de cuotas recibidos"
              icon={Receipt}
              accentColor="border-l-emerald-500"
              iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
              href="/app/documents?tab=notes&status=PAID"
            />
            <KpiCard
              title="Cuotas Pendientes"
              value={formatArs(stats.notes.pendingArs)}
              subtitle="saldo total por cobrar"
              icon={Banknote}
              accentColor="border-l-blue-500"
              iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
              href="/app/documents?tab=notes&status=PENDING"
            />
            <KpiCard
              title="Cuotas Vencidas"
              value={formatArs(stats.notes.overdueArs)}
              subtitle="requieren atención inmediata"
              icon={TriangleAlert}
              accentColor={stats.notes.overdueArs > 0 ? "border-l-red-500" : "border-l-muted"}
              iconColor={stats.notes.overdueArs > 0
                ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                : "bg-muted text-muted-foreground"}
              href="/app/documents?tab=notes&status=OVERDUE"
            />
          </div>
        </div>
      )}

      {/* Analytics de Ventas */}
      <div className="border-t border-adaptive pt-6">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-adaptive-secondary">
          Analíticas de Ventas
        </h2>
        {!analyticsEnabled ? (
          <Card className="surface-secondary">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 backdrop-blur-xl">
                <Lock className="h-6 w-6 text-violet-400" />
              </div>
              <p className="font-semibold text-adaptive-primary">Analíticas no disponibles en tu plan</p>
              <p className="mt-1 text-sm text-adaptive-secondary">
                Actualizá tu suscripción para ver gráficos de ventas, rendimiento y más.
              </p>
              <Link
                href="/app/settings/billing"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                Ver planes
              </Link>
            </CardContent>
          </Card>
        ) : stats.deals.completed > 0 ? (
          <AnalyticsDashboardLazy
            companyId={session.user.companyId}
            companyName={companyName}
            hideHeader
            userRole={userRole}
          />
        ) : (
          <Card className="surface-secondary">
            <CardContent className="py-12 text-center text-adaptive-secondary">
              <Handshake className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="font-semibold text-adaptive-primary">Sin ventas completadas aún</p>
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
