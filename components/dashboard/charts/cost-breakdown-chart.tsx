/**
 * Cost Breakdown Chart - DonutChart con Recharts
 * Sin 'any' - Enterprise Grade
 */

'use client'

import {
  PieChart,
  Pie,
  Cell,
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
  value: number
  percentage: number
}

interface CostBreakdownChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
}

// ============================================================================
// Paleta de colores
// ============================================================================

const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
]

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

export function CostBreakdownChart({ data, isLoading }: CostBreakdownChartProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full" />
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        <span>Sin datos de costos</span>
      </div>
    )
  }

  // Filtrar valores muy pequeños (menos de 1%)
  const significantData = data.filter(item => item.percentage >= 1)

  // Agrupar los pequeños en "Otros" si hay más de 8 categorías
  let processedData = significantData
  if (significantData.length > 8) {
    const topItems = significantData.slice(0, 7)
    const others = significantData.slice(7)
    const othersSum = others.reduce((sum, item) => sum + item.value, 0)
    const othersPercentage = others.reduce((sum, item) => sum + item.percentage, 0)
    
    processedData = [
      ...topItems,
      { name: 'Otros', value: othersSum, percentage: othersPercentage }
    ]
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={processedData}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={(entry: ChartDataPoint) => `${entry.name}: ${entry.percentage.toFixed(1)}%`}
          labelLine={false}
        >
          {processedData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index % COLORS.length]}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name,
          ]}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          iconType="circle"
          wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
