/**
 * Sales vs Profit Chart — Diseño profesional
 * - AreaChart con gradientes suaves y múltiples períodos
 * - Tooltip personalizado con formato de moneda
 * - Eje Y con formato abreviado legible
 * - BarChart como fallback solo si showDetailed=true
 */

'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

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

const formatAxisTick = (value: number, mode: 'consolidated' | 'ars' | 'usd'): string => {
  const prefix = mode === 'usd' ? 'US$' : '$'
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`
  return `${prefix}${value.toFixed(0)}`
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

  // Calcular margen consolidado o promedio
  const salesVal = payloadData.salesArs || 0
  const profitVal = payloadData.profitArs || 0
  const marginPercent = salesVal > 0 ? (profitVal / salesVal) * 100 : 0

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 shadow-xl min-w-[220px] backdrop-blur-sm">
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest">
        {label}
      </p>

      <div className="space-y-1 mb-2.5">
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Ingresos ARS</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{formattedAmount(payloadData.salesArs, 'ARS')}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Ingresos USD</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{formattedAmount(payloadData.salesUsd, 'USD')}</span>
        </div>
      </div>

      <div className="space-y-1 mb-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/40">
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Ganancia ARS</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formattedAmount(payloadData.profitArs, 'ARS')}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Ganancia USD</span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formattedAmount(payloadData.profitUsd, 'USD')}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/40 space-y-1">
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Operaciones</span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{payloadData.dealCount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Margen Neto</span>
          <span className={cn("text-xs font-extrabold", marginPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {marginPercent.toFixed(1)}%
          </span>
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
    operationalCosts: 'Gastos Operativos',
    dealCount: 'Cantidad de Operaciones'
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
  const [currencyMode, setCurrencyMode] = useState<'consolidated' | 'ars' | 'usd'>('consolidated')

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

  // Dynamic keys based on selected currency
  const salesKey = currencyMode === 'consolidated' ? 'sales' : currencyMode === 'ars' ? 'salesArs' : 'salesUsd'
  const profitKey = currencyMode === 'consolidated' ? 'profit' : currencyMode === 'ars' ? 'profitArs' : 'profitUsd'
  const unitCostsKey = currencyMode === 'consolidated' ? 'unitCosts' : currencyMode === 'ars' ? 'unitCostsArs' : 'unitCostsUsd'
  const operationalCostsKey = currencyMode === 'consolidated' ? 'operationalCosts' : currencyMode === 'ars' ? 'operationalCostsArs' : 'operationalCostsUsd'

  const handlePointClick = (event: any) => {
    if (!onPointClick || !event?.activePayload || event.activePayload.length === 0) {
      return
    }
    const payload = event.activePayload[0].payload as ChartDataPoint | undefined
    if (!payload) return
    onPointClick(payload)
  }

  const renderContent = () => {
    if (showDetailed) {
      // Mixed ComposedChart showing Bar values + Line with dealCount on secondary YAxis
      return (
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart
            data={data}
            margin={{ top: 15, right: 10, left: 10, bottom: 0 }}
            barCategoryGap="20%"
            barGap={4}
            onClick={handlePointClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            {/* Left axis: monetary values */}
            <YAxis
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => formatAxisTick(val, currencyMode)}
              width={75}
            />
            {/* Right axis: transaction count */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#8b5cf6', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `${val} ops`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(226, 232, 240, 0.2)' }} />
            <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={legendFormatter} />
            
            <Bar yAxisId="left" dataKey={salesKey} fill="#6366f1" radius={[4, 4, 0, 0]} name="sales" />
            {!isSeller && <Bar yAxisId="left" dataKey={profitKey} fill="#10b981" radius={[4, 4, 0, 0]} name="profit" />}
            {!isSeller && <Bar yAxisId="left" dataKey={unitCostsKey} fill="#f97316" radius={[4, 4, 0, 0]} name="unitCosts" />}
            {!isSeller && <Bar yAxisId="left" dataKey={operationalCostsKey} fill="#ef4444" radius={[4, 4, 0, 0]} name="operationalCosts" />}
            
            {/* Secondary line chart overlay for deal counts */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="dealCount"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: 'white' }}
              activeDot={{ r: 6, fill: '#8b5cf6', stroke: 'white', strokeWidth: 2 }}
              name="dealCount"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )
    }

    // Default overview mode (AreaChart): Ventas vs Ganancias simplificado y prolijo
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} onClick={handlePointClick}>
          <defs>
            <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => formatAxisTick(val, 'consolidated')}
            width={65}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

          <Legend wrapperStyle={{ paddingTop: '8px' }} formatter={legendFormatter} />

          <Area
            type="monotone"
            dataKey="sales"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#gradSales)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
            name="sales"
          />
          {!isSeller && (
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#gradProfit)"
              dot={false}
              activeDot={{ r: 4, fill: '#10b981', stroke: 'white', strokeWidth: 2 }}
              name="profit"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Si no es detallado, renderizamos el AreaChart limpio directamente ocupando el 100% de la altura
  if (!showDetailed) {
    return renderContent()
  }

  return (
    <div className="w-full h-full flex flex-col space-y-3">
      {/* Dynamic currency filter selector */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/40">
        <span className="text-[10px] font-extrabold text-adaptive-secondary tracking-widest uppercase">Filtro de Moneda</span>
        <div className="flex bg-slate-100/80 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
          {[
            { id: 'consolidated', label: 'Consolidado ARS' },
            { id: 'ars', label: 'Sólo ARS' },
            { id: 'usd', label: 'Sólo USD' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setCurrencyMode(mode.id as any)}
              className={cn(
                "px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200",
                currencyMode === mode.id
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}
