'use client'

/**
 * Dashboard KPIs - Tarjetas de métricas clave
 * Estilo SaaS corporativo — jerarquía visual clara
 * Clickeable para abrir detalles de operaciones
 */

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, DollarSign, Users, Package, Percent } from 'lucide-react'
import { formatCurrencyCompact, formatNumberCompact, formatPercentage, formatCurrency } from '@/lib/domains/analytics/hooks'
import type { DashboardSummary } from '@/lib/domains/analytics/types'
import { cn } from '@/lib/utils'

// ============================================================================
// Tipos
// ============================================================================

interface DashboardKPIsProps {
  data: DashboardSummary | undefined
  isLoading: boolean
  userRole?: string
  onRevenueClick?: () => void
  onProfitClick?: () => void
  onDealsClick?: () => void
}

interface KPICardProps {
  title: string
  value: string
  subtitle: string
  detail?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  iconBg?: string
  isLoading: boolean
  onClick?: () => void
}

// ============================================================================
// KPI Card individual
// ============================================================================

function KPICard({
  title,
  value,
  subtitle,
  detail,
  trend = 'neutral',
  icon: Icon,
  iconBg = 'bg-blue-50 dark:bg-blue-950/40',
  isLoading,
  onClick,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-7 w-28 mb-1.5" />
        <Skeleton className="h-3 w-20" />
      </Card>
    )
  }

  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
      ? 'text-red-500 dark:text-red-400'
      : 'text-muted-foreground'

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null

  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'p-5 transition-all duration-200',
        onClick ? 'hover:shadow-lg hover:scale-105 cursor-pointer hover:bg-muted/50 focus:ring-2 focus:ring-blue-500/30 focus:outline-none' : 'hover:shadow-md'
      )}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {/* Valor principal — formato compacto */}
      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
        {value}
      </p>

      {/* Detalle completo en tooltip visual */}
      {detail && (
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{detail}</p>
      )}

      {/* Subtítulo con trend */}
      <div className={cn('flex items-center gap-1 text-xs mt-2', trendColor)}>
        {TrendIcon && <TrendIcon className="h-3 w-3" />}
        <span>{subtitle}</span>
      </div>

      {/* Indicador visual de que es clickeable */}
      {onClick && (
        <p className="text-[10px] text-muted-foreground mt-2 italic">Haz click para ver detalles</p>
      )}
    </Card>
  )
}

// ============================================================================
// Componente principal
// ============================================================================

export function DashboardKPIs({
  data,
  isLoading,
  userRole,
  onRevenueClick,
  onProfitClick,
  onDealsClick,
}: DashboardKPIsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICard
            key={i}
            title="—"
            value="-"
            subtitle="-"
            icon={DollarSign}
            isLoading={true}
          />
        ))}
      </div>
    )
  }

  const { kpis, inventory, period } = data

  const revenueValue =
    kpis.totalRevenue.ars > 0 && kpis.totalRevenue.usd > 0
      ? `${formatCurrencyCompact(kpis.totalRevenue.ars, 'ARS')} / ${formatCurrencyCompact(kpis.totalRevenue.usd, 'USD')}`
      : kpis.totalRevenue.usd > 0
      ? formatCurrencyCompact(kpis.totalRevenue.usd, 'USD')
      : formatCurrencyCompact(kpis.totalRevenue.ars, 'ARS')

  const revenueDetail = [
    kpis.totalRevenue.ars > 0 ? formatCurrency(kpis.totalRevenue.ars, 'ARS') : null,
    kpis.totalRevenue.usd > 0 ? formatCurrency(kpis.totalRevenue.usd, 'USD') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const profitValue =
    kpis.netProfit.ars > 0 && kpis.netProfit.usd > 0
      ? `${formatCurrencyCompact(kpis.netProfit.ars, 'ARS')} / ${formatCurrencyCompact(kpis.netProfit.usd, 'USD')}`
      : kpis.netProfit.usd > 0
      ? formatCurrencyCompact(kpis.netProfit.usd, 'USD')
      : formatCurrencyCompact(kpis.netProfit.ars, 'ARS')

  const profitDetail = [
    kpis.netProfit.ars !== 0 ? formatCurrency(kpis.netProfit.ars, 'ARS') : null,
    kpis.netProfit.usd !== 0 ? formatCurrency(kpis.netProfit.usd, 'USD') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Ingresos Totales"
        value={revenueValue}
        subtitle={period.label}
        detail={revenueDetail}
        trend="up"
        icon={DollarSign}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        isLoading={false}
        onClick={onRevenueClick}
      />

      {userRole !== 'SELLER' && (
        <KPICard
          title="Ganancia Neta"
          value={profitValue}
          subtitle={`Margen: ${formatPercentage(kpis.profitMargin)}`}
          detail={profitDetail}
          trend={kpis.profitMargin > 0 ? 'up' : 'down'}
          icon={Percent}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          isLoading={false}
          onClick={onProfitClick}
        />
      )}

      <KPICard
        title="Operaciones"
        value={String(kpis.totalDeals)}
        subtitle={`Promedio: ${formatCurrencyCompact(kpis.avgDealSize)}`}
        icon={Users}
        iconBg="bg-purple-50 dark:bg-purple-950/40"
        isLoading={false}
        onClick={onDealsClick}
      />

      <KPICard
        title="Inventario"
        value={String(inventory.totalUnits)}
        subtitle={`${inventory.availableUnits} disponibles · ${inventory.reservedUnits} reservadas`}
        icon={Package}
        iconBg="bg-slate-50 dark:bg-slate-800/60"
        isLoading={false}
      />
    </div>
  )
}
