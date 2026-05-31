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
import { useAnalyticsDealDetails } from '@/lib/domains/analytics/use-deal-details'
import type { TimeRange } from '@/lib/domains/analytics/types'
import { SalesProfitChart } from './charts/sales-profit-chart'
import { TopSellersChart } from './charts/top-sellers-chart'
import { CostBreakdownChart } from './charts/cost-breakdown-chart'
import { DashboardKPIs } from './dashboard-kpis'
import { DealDetailsModal } from './deal-details-modal'
import { CostDetailsModal } from './cost-details-modal'
import { DashboardSkeleton } from './loading-skeleton'
import { EmptyState } from './empty-state'
import { AlertCircle, TrendingUp, Users, DollarSign, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CostItemDetail } from '@/lib/domains/analytics/types'
import { useRealtimeDeals } from '@/lib/hooks/use-realtime-deals'


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
  const { dashboard, salesProfit, topSellers, costs, isLoadingAny, hasError, mutateAll } = useAllAnalytics(timeRange, companyId)
  
  // Refresh analytics live via Pusher
  useRealtimeDeals({
    companyId,
    onDealCreated: () => mutateAll(),
    onDealUpdated: () => mutateAll(),
    onDealDeleted: () => mutateAll()
  })
  
  // Estados para modales de detalles
  const [revenueModalOpen, setRevenueModalOpen] = useState(false)
  const [profitModalOpen, setProfitModalOpen] = useState(false)
  const [dealsModalOpen, setDealsModalOpen] = useState(false)
  const [daySummaryOpen, setDaySummaryOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<{ date: string; label: string } | null>(null)
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [selectedCostCategory, setSelectedCostCategory] = useState('')
  const [selectedCostItems, setSelectedCostItems] = useState<CostItemDetail[]>([])
  const [selectedDayData, setSelectedDayData] = useState<{
    salesArs: number
    salesUsd: number
    profitArs: number
    profitUsd: number
    costsArs: number
    costsUsd: number
    dealCount: number
  } | null>(null)

  // Fetch detalles de deals cuando se abren los modales
  const { deals: revenueDeal, period: revenuePeriod, isLoading: revenueLoading } = useAnalyticsDealDetails(
    timeRange,
    'revenue',
    undefined,
    revenueModalOpen
  )

  const { deals: profitDeal, period: profitPeriod, isLoading: profitLoading } = useAnalyticsDealDetails(
    timeRange,
    'revenue',
    undefined,
    profitModalOpen
  )

  const { deals: allDeal, period: allPeriod, isLoading: dealsLoading } = useAnalyticsDealDetails(
    timeRange,
    'all',
    undefined,
    dealsModalOpen
  )

  const { deals: dayDeals, period: dayPeriod, isLoading: dayLoading } = useAnalyticsDealDetails(
    timeRange,
    'all',
    undefined,
    daySummaryOpen && !!selectedDay,
    selectedDay?.date
  )
  
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
          <DashboardKPIs
            data={dashboard.summary}
            isLoading={dashboard.isLoading}
            userRole={userRole}
            onRevenueClick={() => setRevenueModalOpen(true)}
            onProfitClick={() => setProfitModalOpen(true)}
            onDealsClick={() => setDealsModalOpen(true)}
            onInventoryClick={() => window.location.href = '/app/units'}
          />

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
                <Card className="col-span-2 surface-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-adaptive-primary">
                      <TrendingUp className="h-5 w-5" />
                      {isSeller ? "Mis Ventas" : "Ventas vs Ganancias"}
                    </CardTitle>
                    <CardDescription className="text-adaptive-secondary">
                      {isSeller ? "Evolución temporal de tus ingresos" : "Comparativa temporal de ingresos y márgenes"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <SalesProfitChart 
                      data={salesProfit.chartData} 
                      isLoading={salesProfit.isLoading}
                      isSeller={isSeller}
                      onPointClick={(point) => {
                        setSelectedDay({ date: point.date, label: point.name })
                        setSelectedDayData({
                          salesArs: point.salesArs,
                          salesUsd: point.salesUsd,
                          profitArs: point.profitArs,
                          profitUsd: point.profitUsd,
                          costsArs: point.costsArs,
                          costsUsd: point.costsUsd,
                          dealCount: point.dealCount,
                        })
                        setDaySummaryOpen(true)
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Top Vendedores */}
                {!isSeller && (
                  <Card className="surface-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-adaptive-primary">
                        <Users className="h-5 w-5" />
                        Top Vendedores
                      </CardTitle>
                      <CardDescription className="text-adaptive-secondary">
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
              <Card className="surface-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-adaptive-primary">
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

              {/* Tabla Detallada Multidivisa */}
              {salesProfit.chartData && salesProfit.chartData.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/40 surface-primary">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/40 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-adaptive-primary">Métricas por Período</h4>
                      <p className="text-xs text-adaptive-secondary mt-0.5">Desglose en ARS y USD</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 rounded-full uppercase tracking-wider">
                      {salesProfit.chartData.length} períodos
                    </span>
                  </div>

                  {/* Tabla */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] font-semibold text-adaptive-secondary uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/40">
                          <th className="px-5 py-3 text-left">Período</th>
                          <th className="px-4 py-3 text-center">Ops.</th>
                          <th className="px-5 py-3 text-right">Ingresos</th>
                          {!isSeller && <th className="px-5 py-3 text-right">Ganancia</th>}
                          {!isSeller && <th className="px-5 py-3 text-right hidden lg:table-cell">Costo Unid.</th>}
                          {!isSeller && <th className="px-5 py-3 text-right hidden lg:table-cell">G. Operativos</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {salesProfit.chartData.map((row, idx) => {
                          const hasData = row.dealCount > 0
                          return (
                            <tr
                              key={row.date}
                              className={cn(
                                "border-b border-slate-100/70 dark:border-slate-800/30 transition-colors",
                                "hover:bg-slate-50/60 dark:hover:bg-slate-800/20",
                                idx === salesProfit.chartData.length - 1 && "border-b-0"
                              )}
                            >
                              {/* Período */}
                              <td className="px-5 py-3.5 font-semibold text-adaptive-primary whitespace-nowrap">
                                {row.name}
                              </td>

                              {/* Operaciones */}
                              <td className="px-4 py-3.5 text-center">
                                {hasData ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                                    {row.dealCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                                )}
                              </td>

                              {/* Ingresos */}
                              <td className="px-5 py-3.5 text-right">
                                {hasData ? (
                                  <div>
                                    <div className="font-bold text-adaptive-primary text-sm">{formatCurrency(row.salesArs, 'ARS')}</div>
                                    {row.salesUsd > 0 && (
                                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatCurrency(row.salesUsd, 'USD')}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                                )}
                              </td>

                              {/* Ganancia */}
                              {!isSeller && (
                                <td className="px-5 py-3.5 text-right">
                                  {hasData ? (
                                    <div>
                                      <div className={cn("font-bold text-sm", row.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                        {formatCurrency(row.profitArs, 'ARS')}
                                      </div>
                                      {row.profitUsd !== 0 && (
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatCurrency(row.profitUsd, 'USD')}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                                  )}
                                </td>
                              )}

                              {/* Costo Unidades */}
                              {!isSeller && (
                                <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                                  {hasData && row.unitCostsArs > 0 ? (
                                    <div>
                                      <div className="font-medium text-adaptive-primary text-sm">{formatCurrency(row.unitCostsArs, 'ARS')}</div>
                                      {row.unitCostsUsd > 0 && (
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatCurrency(row.unitCostsUsd, 'USD')}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                                  )}
                                </td>
                              )}

                              {/* Gastos Operativos */}
                              {!isSeller && (
                                <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                                  {row.operationalCostsArs > 0 ? (
                                    <div>
                                      <div className="font-medium text-adaptive-primary text-sm">{formatCurrency(row.operationalCostsArs, 'ARS')}</div>
                                      {row.operationalCostsUsd > 0 && (
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatCurrency(row.operationalCostsUsd, 'USD')}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Totales */}
                  <div className="px-5 py-3 border-t border-slate-200/60 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between text-xs text-adaptive-secondary">
                    <span>
                      Total del período: <strong className="text-adaptive-primary">
                        {salesProfit.chartData.reduce((acc, r) => acc + r.dealCount, 0)} operaciones
                      </strong>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(salesProfit.chartData.reduce((acc, r) => acc + r.salesArs, 0), 'ARS')}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {!isSeller && (
              <TabsContent value="costs" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="surface-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-adaptive-primary">
                        <Package className="h-5 w-5" />
                        Distribución de Costos
                      </CardTitle>
                      <CardDescription className="text-adaptive-secondary">
                        Desglose por categoría
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                      <CostBreakdownChart 
                        data={costs.pieData}
                        isLoading={costs.isLoading}
                        onCategoryClick={(categoryName, items) => {
                          setSelectedCostCategory(categoryName)
                          setSelectedCostItems(items)
                          setCostModalOpen(true)
                        }}
                      />
                    </CardContent>
                  </Card>

                  <Card className="surface-primary border border-border shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold text-adaptive-primary flex items-center gap-2">
                        <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                        Resumen de Costos
                      </CardTitle>
                      <CardDescription className="text-xs text-adaptive-secondary">
                        Totales agrupados por tipo de gasto
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center">
                      {costs.isLoading ? (
                        <div className="space-y-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse" />
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </div>
                      ) : costs.analytics ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/25 px-2 rounded-lg transition-colors">
                            <span className="text-xs font-semibold text-adaptive-secondary">Gastos Operativos</span>
                            <span className="text-xs font-bold text-adaptive-primary">
                              {formatCurrency(costs.analytics.byType.operational.totalConverted)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/25 px-2 rounded-lg transition-colors">
                            <span className="text-xs font-semibold text-adaptive-secondary">Mantenimiento de Unidades</span>
                            <span className="text-xs font-bold text-adaptive-primary">
                              {formatCurrency(costs.analytics.byType.maintenance.totalConverted)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/25 px-2 rounded-lg transition-colors">
                            <span className="text-xs font-semibold text-adaptive-secondary">Comisiones de Vendedores</span>
                            <span className="text-xs font-bold text-adaptive-primary">
                              {formatCurrency(costs.analytics.byType.commissions.totalConverted)}
                            </span>
                          </div>
                          <div className="border-t border-border mt-3 pt-3.5 flex justify-between items-center px-2">
                            <span className="text-xs font-bold text-adaptive-primary">Total Acumulado</span>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
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

          <DealDetailsModal
            isOpen={daySummaryOpen}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedDay(null)
                setSelectedDayData(null)
              }
              setDaySummaryOpen(open)
            }}
            title={selectedDay ? `Detalles del ${selectedDay.label}` : 'Detalles del día'}
            deals={dayDeals}
            isLoading={dayLoading}
            period={dayPeriod}
            summary={selectedDayData ?? undefined}
            userRole={userRole}
            onDealUpdated={() => mutateAll()}
          />

          <DealDetailsModal
            isOpen={revenueModalOpen}
            onOpenChange={setRevenueModalOpen}
            title="Ingresos Totales"
            deals={revenueDeal}
            isLoading={revenueLoading}
            period={revenuePeriod}
            userRole={userRole}
            onDealUpdated={() => mutateAll()}
          />

          <DealDetailsModal
            isOpen={profitModalOpen}
            onOpenChange={setProfitModalOpen}
            title="Ganancia Neta"
            deals={profitDeal}
            isLoading={profitLoading}
            period={profitPeriod}
            userRole={userRole}
            onDealUpdated={() => mutateAll()}
          />

          <DealDetailsModal
            isOpen={dealsModalOpen}
            onOpenChange={setDealsModalOpen}
            title="Operaciones Cerradas"
            deals={allDeal}
            isLoading={dealsLoading}
            period={allPeriod}
            userRole={userRole}
            onDealUpdated={() => mutateAll()}
          />

          <CostDetailsModal
            isOpen={costModalOpen}
            onOpenChange={setCostModalOpen}
            categoryName={selectedCostCategory}
            items={selectedCostItems}
            timeRangeLabel={options.find(o => o.value === timeRange)?.label}
          />
        </>
    </div>
  )
}
