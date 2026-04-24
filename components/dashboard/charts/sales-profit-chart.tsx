/**
 * Sales vs Profit Chart - AreaChart con Recharts
 * Sin 'any' - Enterprise Grade
 */

'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================================
// Tipos estrictos
// ============================================================================

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

// ============================================================================
// Formateador de moneda para tooltip
// ============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ============================================================================
// Componente
// ============================================================================

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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
          </linearGradient>
          {showDetailed && (
            <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          tick={{ fill: 'currentColor', fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis 
          tick={{ fill: 'currentColor', fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value: number) => `$${(value / 1000000).toFixed(1)}M`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number, name: string) => [formatCurrency(value), name === 'sales' ? 'Ventas' : name === 'profit' ? 'Ganancia' : 'Costos']}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value: string) => value === 'sales' ? 'Ventas' : value === 'profit' ? 'Ganancia' : 'Costos'}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorSales)"
          strokeWidth={2}
          name="sales"
        />
        <Area
          type="monotone"
          dataKey="profit"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorProfit)"
          strokeWidth={2}
          name="profit"
        />
        {showDetailed && (
          <Area
            type="monotone"
            dataKey="costs"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorCosts)"
            strokeWidth={2}
            name="costs"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
