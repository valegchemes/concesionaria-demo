'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Car, Handshake, TrendingUp, AlertCircle, Clock,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Minus, Lock,
  Banknote, Receipt, TriangleAlert, Loader2,
} from 'lucide-react'
import { AnalyticsDashboardLazy } from '@/components/dashboard/analytics-dashboard-lazy'
import { useDashboardData } from '@/lib/hooks/use-dashboard'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

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
    maximumFractionDigits: 0,
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
    <Card className={`relative overflow-hidden border-l-[3px] ${accentColor} surface-secondary hover:-translate-y-0.5 hover:shadow-card-md transition-all duration-200 group ${href ? 'cursor-pointer' : ''}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconColor} transition-transform duration-200 group-hover:scale-110`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-black text-adaptive-primary tabular">{value}</div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${
            trend.value > 0 ? 'text-emerald-600 dark:text-emerald-400'
            : trend.value < 0 ? 'text-red-500 dark:text-red-400'
            : 'text-muted-foreground'}`}>
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
      bg: 'bg-blue-500/8 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-800/40',
      label: 'text-blue-600 dark:text-blue-400',
      icon: 'text-blue-500/60 dark:text-blue-400/60',
      value: 'text-blue-700 dark:text-blue-300',
    },
    green: {
      bg: 'bg-emerald-500/8 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-800/40',
      label: 'text-emerald-600 dark:text-emerald-400',
      icon: 'text-emerald-500/60 dark:text-emerald-400/60',
      value: 'text-emerald-700 dark:text-emerald-300',
    },
    red: {
      bg: 'bg-red-500/8 dark:bg-red-500/10 border-red-200/60 dark:border-red-800/40',
      label: 'text-red-500 dark:text-red-400',
      icon: 'text-red-400/60 dark:text-red-400/60',
      value: 'text-red-600 dark:text-red-300',
    },
  }
  const c = colorMap[color]

  const content = (
    <div className={`flex items-center justify-between rounded-xl border p-4 ${c.bg} transition-all duration-200 hover:-translate-y-0.5 ${href ? 'cursor-pointer' : ''}`}>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${c.label}`}>{label}</p>
        <p className={`mt-1 text-3xl font-black tabular ${c.value}`}>{formatNumber(value)}</p>
        <p className={`mt-0.5 text-[11px] text-muted-foreground`}>{sublabel}</p>
      </div>
      <Icon className={`h-9 w-9 ${c.icon}`} />
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }
  return content
}

export default function DashboardContent() {
  const { stats, companyName, analyticsEnabled, userRole, isLoading, isError, refresh } = useDashboardData()
  const { user } = useCurrentUser()

  const conversionRate =
    stats.leads.total > 0
      ? Math.min(100, (stats.deals.completed / stats.leads.total) * 100).toFixed(1)
      : '0'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="surface-secondary max-w-md">
          <CardContent className="py-8 text-center">
            <p className="font-semibold text-red-500 mb-2">Error al cargar el dashboard</p>
            <p className="text-sm text-muted-foreground mb-4">Los datos no pudieron ser obtenidos. Reintentá.</p>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-adaptive-primary tracking-tight">Dashboard</h1>
        {companyName && (
          <p className="mt-0.5 text-sm text-muted-foreground">{companyName}</p>
        )}
      </div>

      {stats.sellerCommission && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Mis Ganancias y Comisiones
            </h2>
            <span className="w-fit inline-flex items-center rounded-full bg-violet-500/10 dark:bg-violet-950/40 border border-violet-200/20 dark:border-violet-800/40 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              Comisión Asignada: {stats.sellerCommission.commissionRate}%
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Resumen Operacional
        </h2>

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatPill
            label="En Curso"
            value={stats.deals.active}
            sublabel="negociaciones activas"
            icon={Clock}
            color="blue"
            href="/app/deals?status=NEGOTIATION,RESERVED,APPROVED,IN_PAYMENT"
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

      <div className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Usados en Parte de Pago (Permutas)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatPill
            label="A Ingresar"
            value={stats.units.pendingTradeIns}
            sublabel="pendientes de conversión"
            icon={Clock}
            color="blue"
            href="/app/units?status=TRADE_IN"
          />
          <StatPill
            label="En Stock"
            value={stats.units.tradeInTotal - stats.units.tradeInSold}
            sublabel="permutas disponibles"
            icon={Car}
            color="green"
            href="/app/units"
          />
          <StatPill
            label="Vendidos"
            value={stats.units.tradeInSold}
            sublabel="permutas liquidadas"
            icon={CheckCircle}
            color="blue"
            href="/app/units?status=SOLD"
          />
        </div>
      </div>

      {(stats.notes.collectedArs > 0 || stats.notes.pendingArs > 0 || stats.notes.overdueArs > 0) && (
        <div className="space-y-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
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

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
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
            companyId={user?.companyId ?? ''}
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
