/**
 * Cost Breakdown Chart — DonutChart corporativo
 * Leyenda lateral, sin labels externos, colores sobrios
 */

'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================================
// Tipos
// ============================================================================

interface ChartDataPoint {
  name: string
  value: number
  percentage: number
}

interface CostBreakdownChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
}

// ============================================================================
// Paleta sobria (colores oscuros muted, no saturados)
// ============================================================================

const COLORS = [
  '#3b82f6', // blue-500
  '#64748b', // slate-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
]

// ============================================================================
// Formateador
// ============================================================================

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)

// ============================================================================
// Tooltip personalizado
// ============================================================================

interface TooltipPayloadItem {
  name: string
  value: number
  payload: ChartDataPoint
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-0.5">{item.name}</p>
      <p className="text-muted-foreground">
        {new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 0,
        }).format(item.value)}
      </p>
      <p className="text-xs text-muted-foreground">{item.payload.percentage.toFixed(1)}% del total</p>
    </div>
  )
}

// ============================================================================
// Componente principal
// ============================================================================

export function CostBreakdownChart({ data, isLoading }: CostBreakdownChartProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-lg" />
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        Sin datos de costos en este período
      </div>
    )
  }

  // Group categories less than 1.5% into "Otros gastos" for cleaner chart & legend
  const threshold = 1.5
  const mainCategories = data.filter((d) => d.percentage >= threshold)
  const minorCategories = data.filter((d) => d.percentage < threshold)
  
  let processedData = [...mainCategories]
  if (minorCategories.length > 0) {
    const minorValue = minorCategories.reduce((sum, item) => sum + item.value, 0)
    const minorPercent = minorCategories.reduce((sum, item) => sum + item.percentage, 0)
    if (minorValue > 0) {
      processedData.push({
        name: 'Otros menores',
        value: minorValue,
        percentage: minorPercent,
      })
    }
  }

  // Sort by value descending so the pie slices flow beautifully
  processedData.sort((a, b) => b.value - a.value)

  return (
    <div className="flex h-full gap-4">
      {/* Donut chart — sin labels externos */}
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              strokeWidth={0}
            >
              {processedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda lateral elegante con hover */}
      <div className="flex flex-col gap-1 w-52 shrink-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
        {processedData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2.5 min-w-0 p-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition-colors cursor-default">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-adaptive-primary truncate">{item.name}</p>
              <p className="text-[10px] text-adaptive-secondary tabular-nums font-medium">
                {item.percentage.toFixed(1)}% · {formatCurrency(item.value)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
