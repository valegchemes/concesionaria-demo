/**
 * Sales vs Profit Chart — Diseño profesional
 * - AreaChart con gradientes suaves y múltiples períodos
 * - Tooltip personalizado con formato de moneda
 * - Eje Y con formato abreviado legible
 * - BarChart como fallback solo si showDetailed=true
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
  TooltipProps,
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

// ── Formateo de ejes ──────────────────────────────────────────────────────────

const formatAxisTick = (value: number): string => {
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

// ── Tooltip personalizado ─────────────────────────────────────────────────────

interface CustomTooltipPayload {
  dataKey: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null

  const items: CustomTooltipPayload[] = (payload as CustomTooltipPayload[]).filter(
    (p) => p.value > 0 || (payload as CustomTooltipPayload[]).some((x) => x.value > 0)
  )

  const labelMap: Record<string, string> = {
    sales: 'Ventas',
    profit: 'Ganancia',
    costs: 'Costos',
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)',
        minWidth: '180px',
      }}
    >
      <p
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#64748b',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </p>
      {items.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: entry.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '13px', color: '#374151' }}>
              {labelMap[entry.dataKey] ?? entry.dataKey}
            </span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
            {formatCurrencyFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Leyenda personalizada ─────────────────────────────────────────────────────

const legendFormatter = (value: string) => {
  const map: Record<string, string> = { sales: 'Ventas', profit: 'Ganancia', costs: 'Costos' }
  return <span style={{ fontSize: '12px', color: '#64748b' }}>{map[value] ?? value}</span>
}

// ── Colores de las series ─────────────────────────────────────────────────────

const COLORS = {
  sales: { stroke: '#6366f1', fill: 'url(#gradSales)' },
  profit: { stroke: '#10b981', fill: 'url(#gradProfit)' },
  costs: { stroke: '#f97316', fill: 'url(#gradCosts)' },
}

// ── Componente principal ──────────────────────────────────────────────────────

export function SalesProfitChart({ data, isLoading, showDetailed = false }: SalesProfitChartProps) {
  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-xl" />
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 4 4-4" />
        </svg>
        <span className="text-sm">Sin datos para el período seleccionado</span>
      </div>
    )
  }

  // Análisis detallado → BarChart (más legible con pocos datos)
  if (showDetailed) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} barCategoryGap="25%" barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatAxisTick}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={legendFormatter} />
          <Bar dataKey="sales" fill="#6366f1" radius={[6, 6, 0, 0]} name="sales" />
          <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="profit" />
          <Bar dataKey="costs" fill="#f97316" radius={[6, 6, 0, 0]} name="costs" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Vista resumen → AreaChart con gradientes (muestra todos los meses del rango)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradCosts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatAxisTick}
          width={60}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

        <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={legendFormatter} />

        <Area
          type="monotone"
          dataKey="sales"
          stroke={COLORS.sales.stroke}
          strokeWidth={2.5}
          fill={COLORS.sales.fill}
          dot={false}
          activeDot={{ r: 5, fill: COLORS.sales.stroke, stroke: 'white', strokeWidth: 2 }}
          name="sales"
        />
        <Area
          type="monotone"
          dataKey="profit"
          stroke={COLORS.profit.stroke}
          strokeWidth={2.5}
          fill={COLORS.profit.fill}
          dot={false}
          activeDot={{ r: 5, fill: COLORS.profit.stroke, stroke: 'white', strokeWidth: 2 }}
          name="profit"
        />
        <Area
          type="monotone"
          dataKey="costs"
          stroke={COLORS.costs.stroke}
          strokeWidth={2}
          fill={COLORS.costs.fill}
          dot={false}
          activeDot={{ r: 5, fill: COLORS.costs.stroke, stroke: 'white', strokeWidth: 2 }}
          name="costs"
          strokeDasharray="5 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
