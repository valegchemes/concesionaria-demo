/**
 * Dashboard de Analíticas Enterprise
 * - Gráficos con Recharts
 * - Estados de Loading y Empty
 * - Caché de 5 minutos via SWR
 * - Sin 'any'
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTimeRange, useAllAnalytics, formatCurrency, formatPercentage } from '@/lib/domains/analytics/hooks'
import type { TimeRange } from '@/lib/domains/analytics/types'
import { SalesProfitChart } from './charts/sales-profit-chart'
import { TopSellersChart } from './charts/top-sellers-chart'
import { CostBreakdownChart } from './charts/cost-breakdown-chart'
import { DashboardKPIs } from './dashboard-kpis'
import { DashboardSkeleton } from './loading-skeleton'
import { EmptyState } from './empty-state'
import { AlertCircle, TrendingUp, Users, DollarSign, Package } from 'lucide-react'
import { cn } from '@/lib/utils'


// ============================================================================
// Props tipadas (sin any)
// ============================================================================

interface AnalyticsDashboardProps {
  companyId: string | undefined
  companyName?: string
  hideHeader?: boolean
  userRole?: string
}

// ============================================================================
// Componente Principal
// ============================================================================

export function AnalyticsDashboard({ companyId, companyName, hideHeader = false, userRole }: AnalyticsDashboardProps) {
  const { timeRange, setTimeRange, options } = useTimeRange('30d')
  const { dashboard, salesProfit, topSellers, costs, isLoadingAny, hasError } = useAllAnalytics(timeRange, companyId)
  
  const isSeller = userRole === 'SELLER'

  // Si no hay companyId, mostrar error
  if (!companyId) {
    return (
      <div className="rounded-lg border border-destructive/50 text-destructive p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div>
          <h5 className="mb-1 font-medium leading-none tracking-tight">Error de autenticación</h5>
          <div className="text-sm opacity-80">
            No se pudo identificar la empresa. Por favor, inicia sesión nuevamente.
          </div>
        </div>
      </div>
    )
  }

  // Estado de carga
  if (isLoadingAny && !dashboard.summary) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header con selector de tiempo — ocultable cuando se embebe */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard de Analíticas</h1>
            {companyName && (
              <p className="text-muted-foreground">{companyName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Selector de tiempo standalone cuando el header está oculto */}
      {hideHeader && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Error global */}
      {hasError && (
        <div className="rounded-lg border border-destructive/50 text-destructive p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <h5 className="mb-1 font-medium leading-none tracking-tight">Error al cargar datos</h5>
            <div className="text-sm opacity-80">
              Hubo un problema al obtener las métricas. Intenta recargar la página.
            </div>
          </div>
        </div>
      )}

      {/* KPIs — siempre visibles (muestran 0 si no hay datos) */}
      <>
          <DashboardKPIs data={dashboard.summary} isLoading={dashboard.isLoading} userRole={userRole} />

          {/* Tabs con gráficos */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className={cn("grid w-full", isSeller ? "grid-cols-2 lg:w-[260px]" : "grid-cols-3 lg:w-[400px]")}>
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              {!isSeller && <TabsTrigger value="costs">Costos</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Gráfico de Ventas vs Ganancias */}
                <Card className="col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {isSeller ? "Mis Ventas" : "Ventas vs Ganancias"}
                    </CardTitle>
                    <CardDescription>
                      {isSeller ? "Evolución temporal de tus ingresos" : "Comparativa temporal de ingresos y márgenes"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <SalesProfitChart 
                      data={salesProfit.chartData} 
                      isLoading={salesProfit.isLoading}
                      isSeller={isSeller}
                    />
                  </CardContent>
                </Card>

                {/* Top Vendedores */}
                {!isSeller && (
                  <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Top Vendedores
                      </CardTitle>
                      <CardDescription>
                        Ranking por volumen de ventas
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <TopSellersChart 
                        data={topSellers.chartData}
                        isLoading={topSellers.isLoading}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sales" className="space-y-4">
              <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Análisis Detallado de Ventas
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <SalesProfitChart 
                    data={salesProfit.chartData}
                    isLoading={salesProfit.isLoading}
                    showDetailed
                    isSeller={isSeller}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {!isSeller && (
              <TabsContent value="costs" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Distribución de Costos
                      </CardTitle>
                      <CardDescription>
                        Desglose por categoría
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                      <CostBreakdownChart 
                        data={costs.pieData}
                        isLoading={costs.isLoading}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen de Costos</CardTitle>
                      <CardDescription>
                        Totales por tipo de gasto
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {costs.isLoading ? (
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </div>
                      ) : costs.analytics ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Operativos</span>
                            <span className="font-medium">
                              {formatCurrency(costs.analytics.byType.operational.totalConverted)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Mantenimiento</span>
                            <span className="font-medium">
                              {formatCurrency(costs.analytics.byType.maintenance.totalConverted)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Comisiones</span>
                            <span className="font-medium">
                              {formatCurrency(costs.analytics.byType.commissions.totalConverted)}
                            </span>
                          </div>
                          <div className="border-t pt-4 flex justify-between items-center">
                            <span className="font-semibold">Total</span>
                            <span className="font-bold text-lg">
                              {formatCurrency(costs.analytics.totalCosts.totalConverted)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <EmptyState 
                          title="Sin datos de costos"
                          description="No se registraron costos en este período"
                          compact
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </>
    </div>
  )
}
