/**
 * Sales vs Profit Chart
 * - AreaChart para Resumen (comparativa temporal)
 * - BarChart para Análisis Detallado (siempre legible con pocos datos)
 */

'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartDataPoint {
  name: string
  sales: number
  profit: number
  costs: number
}

interface SalesProfitChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
  showDetailed?: boolean
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const formatCurrencyFull = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
}

// Formateador de nombre de campo para leyenda
const legendFormatter = (value: string) =>
  value === 'sales' ? 'Ventas' : value === 'profit' ? 'Ganancia' : 'Costos'

// Formateador de tooltip
const tooltipFormatter = (value: number, name: string): [string, string] => [
  formatCurrencyFull(value),
  name === 'sales' ? 'Ventas' : name === 'profit' ? 'Ganancia' : 'Costos',
]

export function SalesProfitChart({ data, isLoading, showDetailed = false }: SalesProfitChartProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        <span>Sin datos para mostrar</span>
      </div>
    )
  }

  const isSingleDataPoint = data.length === 1;

  // Análisis detallado o punto único → BarChart agrupado (más legible con pocos datos y evita que AreaChart desaparezca con un solo punto)
  if (showDetailed || isSingleDataPoint) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          barCategoryGap="20%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={tooltipFormatter}
            labelStyle={{ color: '#1e293b', fontWeight: 600, marginBottom: 4 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={legendFormatter}
          />
          <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} name="sales" />
          <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="profit" />
          <Bar dataKey="costs" fill="#f97316" radius={[4, 4, 0, 0]} name="costs" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Vista resumen → AreaChart (mejor para series temporales largas)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={tooltipFormatter}
          labelStyle={{ color: '#1e293b', fontWeight: 600, marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={legendFormatter}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#colorSales)"
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="sales"
        />
        <Area
          type="monotone"
          dataKey="profit"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#colorProfit)"
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="profit"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
