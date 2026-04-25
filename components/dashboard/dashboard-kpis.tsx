/**
 * Dashboard KPIs - Tarjetas de métricas clave
 * Sin 'any' - Enterprise Grade
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, DollarSign, Users, Package, Percent } from 'lucide-react'
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/domains/analytics/hooks'
import type { DashboardSummary } from '@/lib/domains/analytics/types'

// ============================================================================
// Tipos estrictos
// ============================================================================

interface DashboardKPIsProps {
  data: DashboardSummary | undefined
  isLoading: boolean
}

interface KPICardProps {
  title: string
  value: string
  subtitle: string
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  isLoading: boolean
}

// ============================================================================
// Componente de tarjeta individual
// ============================================================================

function KPICard({ title, value, subtitle, trend = 'neutral', icon: Icon, isLoading }: KPICardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-[100px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-[120px] mb-1" />
          <Skeleton className="h-4 w-[80px]" />
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          {TrendIcon && <TrendIcon className={`h-3 w-3 ${trendColor}`} />}
          <span>{subtitle}</span>
        </div>
      </CardContent>
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
            title="Cargando..."
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
        value={formatCurrency(kpis.totalRevenue.totalConverted)}
        subtitle={period.label}
        trend="up"
        icon={DollarSign}
        isLoading={false}
      />

      <KPICard
        title="Ganancia Neta"
        value={formatCurrency(kpis.netProfit.totalConverted)}
        subtitle={`Margen: ${formatPercentage(kpis.profitMargin)}`}
        trend={kpis.profitMargin > 0 ? 'up' : 'down'}
        icon={Percent}
        isLoading={false}
      />

      <KPICard
        title="Operaciones"
        value={formatNumber(kpis.totalDeals)}
        subtitle={`Promedio: ${formatCurrency(kpis.avgDealSize)}`}
        icon={Users}
        isLoading={false}
      />

      <KPICard
        title="Inventario"
        value={formatNumber(inventory.totalUnits)}
        subtitle={`${kpis.totalDeals} vendidas · ${inventory.availableUnits} disp.`}
        icon={Package}
        isLoading={false}
      />
    </div>
  )
}
