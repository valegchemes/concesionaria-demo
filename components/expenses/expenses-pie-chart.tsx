'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/lib/domains/analytics/hooks'

const PIE_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa',
  '#f59e0b', '#fb923c', '#f87171',
  '#34d399', '#22d3ee', '#60a5fa',
  '#e879f9', '#f472b6', '#a3e635',
]

interface PieDataPoint {
  name: string
  value: number
}

interface ExpensesPieChartProps {
  data: PieDataPoint[]
}

export function ExpensesPieChart({ data }: ExpensesPieChartProps) {
  if (data.length === 0) return null

  return (
    <div className="flex-1 min-w-[200px] h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatCurrency(value, 'ARS'), '']}
            contentStyle={{
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              backdropFilter: 'blur(8px)',
            }}
          />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
