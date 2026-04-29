/**
 * Dashboard KPIs - Tarjetas de métricas clave
 * Estilo SaaS corporativo — jerarquía visual clara
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
    <Card className="p-5 hover:shadow-md transition-shadow duration-200">
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
    </Card>
  )
}

// ============================================================================
// Componente principal
// ============================================================================

export function DashboardKPIs({ data, isLoading }: DashboardKPIsProps) {
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Ingresos Totales"
        value={formatCurrencyCompact(kpis.totalRevenue.totalConverted)}
        subtitle={period.label}
        detail={formatCurrency(kpis.totalRevenue.totalConverted)}
        trend="up"
        icon={DollarSign}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        isLoading={false}
      />

      <KPICard
        title="Ganancia Neta"
        value={formatCurrencyCompact(kpis.netProfit.totalConverted)}
        subtitle={`Margen: ${formatPercentage(kpis.profitMargin)}`}
        detail={formatCurrency(kpis.netProfit.totalConverted)}
        trend={kpis.profitMargin > 0 ? 'up' : 'down'}
        icon={Percent}
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        isLoading={false}
      />

      <KPICard
        title="Operaciones"
        value={String(kpis.totalDeals)}
        subtitle={`Promedio: ${formatCurrencyCompact(kpis.avgDealSize)}`}
        icon={Users}
        iconBg="bg-purple-50 dark:bg-purple-950/40"
        isLoading={false}
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
