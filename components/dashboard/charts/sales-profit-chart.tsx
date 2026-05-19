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
  date: string
  sales: number
  profit: number
  costs: number
  unitCosts: number
  operationalCosts: number
  salesArs: number
  salesUsd: number
  profitArs: number
  profitUsd: number
  costsArs: number
  costsUsd: number
  unitCostsArs: number
  unitCostsUsd: number
  operationalCostsArs: number
  operationalCostsUsd: number
  dealCount: number
}

interface SalesProfitChartProps {
  data: ChartDataPoint[]
  isLoading: boolean
  showDetailed?: boolean
  isSeller?: boolean
  onPointClick?: (point: ChartDataPoint) => void
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

  const payloadData = (payload[0] as any)?.payload
  if (!payloadData) return null

  const formattedAmount = (value: number, currency: 'ARS' | 'USD') =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-lg min-w-[220px]">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
        {label}
      </p>

      <div className="mb-2.5">
        <div className="flex justify-between gap-3 mb-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">Ingresos ARS</span>
          <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{formattedAmount(payloadData.salesArs, 'ARS')}</span>
        </div>
        <div className="flex justify-between gap-3 mb-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">Ingresos USD</span>
          <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{formattedAmount(payloadData.salesUsd, 'USD')}</span>
        </div>
      </div>

      <div className="mb-2.5">
        <div className="flex justify-between gap-3 mb-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">Ganancia ARS</span>
          <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{formattedAmount(payloadData.profitArs, 'ARS')}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400">Ganancia USD</span>
          <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{formattedAmount(payloadData.profitUsd, 'USD')}</span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400">Operaciones</span>
          <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{payloadData.dealCount}</span>
        </div>
      </div>
    </div>
  )
}

// ── Leyenda personalizada ─────────────────────────────────────────────────────

const legendFormatter = (value: string) => {
  const map: Record<string, string> = { 
    sales: 'Ingresos', 
    profit: 'Ganancia Neta', 
    unitCosts: 'Costo Unidades',
    operationalCosts: 'Gastos Operativos'
  }
  return <span style={{ fontSize: '12px', color: '#64748b' }}>{map[value] ?? value}</span>
}

// ── Colores de las series ─────────────────────────────────────────────────────

const COLORS = {
  sales: { stroke: '#6366f1', fill: 'url(#gradSales)' },
  profit: { stroke: '#10b981', fill: 'url(#gradProfit)' },
  unitCosts: { stroke: '#f97316', fill: 'url(#gradCosts)' },
  operationalCosts: { stroke: '#ef4444', fill: 'url(#gradOp)' },
}

// ── Componente principal ──────────────────────────────────────────────────────

export function SalesProfitChart({ data, isLoading, showDetailed = false, isSeller = false, onPointClick }: SalesProfitChartProps) {
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
  const handlePointClick = (event: any) => {
    if (!onPointClick || !event?.activePayload || event.activePayload.length === 0) {
      return
    }

    const payload = event.activePayload[0].payload as ChartDataPoint | undefined
    if (!payload) return

    onPointClick(payload)
  }

  if (showDetailed) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
          barCategoryGap="25%"
          barGap={3}
          onClick={handlePointClick}
        >
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
          <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} name="sales" />
          {!isSeller && <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="profit" />}
          {!isSeller && <Bar dataKey="unitCosts" fill="#f97316" radius={[4, 4, 0, 0]} name="unitCosts" />}
          {!isSeller && <Bar dataKey="operationalCosts" fill="#ef4444" radius={[4, 4, 0, 0]} name="operationalCosts" />}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Vista resumen → AreaChart con gradientes (muestra todos los meses del rango)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} onClick={handlePointClick}>
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
          <linearGradient id="gradOp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
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
        {!isSeller && (
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
        )}
        {!isSeller && (
          <Area
            type="monotone"
            dataKey="unitCosts"
            stroke={COLORS.unitCosts.stroke}
            strokeWidth={2}
            fill={COLORS.unitCosts.fill}
            dot={false}
            activeDot={{ r: 4, fill: COLORS.unitCosts.stroke, stroke: 'white', strokeWidth: 2 }}
            name="unitCosts"
            strokeDasharray="5 3"
          />
        )}
        {!isSeller && (
          <Area
            type="monotone"
            dataKey="operationalCosts"
            stroke={COLORS.operationalCosts.stroke}
            strokeWidth={2}
            fill={COLORS.operationalCosts.fill}
            dot={false}
            activeDot={{ r: 4, fill: COLORS.operationalCosts.stroke, stroke: 'white', strokeWidth: 2 }}
            name="operationalCosts"
            strokeDasharray="3 3"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
