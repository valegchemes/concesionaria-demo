/**
 * Top Sellers Chart - BarChart horizontal con Recharts
 * Sin 'any' - Enterprise Grade
 */

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================================
// Tipos estrictos
// ============================================================================

interface ChartDataPoint {
  name: string
  sales: number
  deals: number
}

interface TopSellersChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
}

// ============================================================================
// Colores para barras
// ============================================================================

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// ============================================================================
// Formateador de moneda
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

export function TopSellersChart({ data, isLoading }: TopSellersChartProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        <span>Sin datos de vendedores</span>
      </div>
    )
  }

  // Limitar a top 6 vendedores
  const limitedData = data.slice(0, 6)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={limitedData}
        layout="vertical"
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis 
          type="number" 
          tick={{ fill: 'currentColor', fontSize: 11 }}
          className="text-muted-foreground"
          tickFormatter={(value: number) => `$${(value / 1000000).toFixed(1)}M`}
        />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fill: 'currentColor', fontSize: 12 }}
          className="text-muted-foreground"
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number, name: string) => {
            if (name === 'sales') {
              return [formatCurrency(value), 'Ventas']
            }
            return [value.toString(), name]
          }}
        />
        <Bar 
          dataKey="sales" 
          radius={[0, 4, 4, 0]}
          name="sales"
        >
          {limitedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
