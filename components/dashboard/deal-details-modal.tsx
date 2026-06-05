/**
 * Modal de detalles de operaciones
 * Usa el patrón de modal personalizado del proyecto
 */

'use client'

import { useState } from 'react'
import { X, DollarSign, User, Calendar, Zap, Pencil, AlertCircle, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/domains/analytics/hooks'
import { cn } from '@/lib/utils'
import { EditDealValueModal } from './edit-deal-value-modal'
import useSWR from 'swr'

interface DealDetail {
  id: string
  unitCode: string
  sellerName: string
  sellerId: string
  finalPrice: number
  currency: string
  exchangeRate: number
  status: string
  deliveredAt: string
  createdAt: string
  buyerName?: string
  buyerPhone?: string
  unitModel?: string
  unitCostArs?: number
  unitCostUsd?: number
}

interface DealDetailsSummary {
  salesArs: number
  salesUsd: number
  profitArs: number
  profitUsd: number
  costsArs: number
  costsUsd: number
  dealCount: number
}

interface DealDetailsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  deals: DealDetail[] | undefined
  isLoading?: boolean
  timeRange?: string
  period?: {
    start: string
    end: string
    label: string
  }
  summary?: DealDetailsSummary
  userRole?: string
  error?: Error | null
  onDealUpdated?: () => void
}

export function DealDetailsModal({
  isOpen,
  onOpenChange,
  title,
  deals,
  isLoading = false,
  timeRange = '30d',
  period,
  summary,
  userRole,
  error,
  onDealUpdated,
}: DealDetailsModalProps) {
  const [editingDeal, setEditingDeal] = useState<DealDetail | null>(null)

  // Fetch current company exchange rate
  const { data: meData } = useSWR('/api/me', (url) => fetch(url).then(res => res.json()))
  const globalExchangeRate = meData?.exchangeRateArsPerUsd ? Number(meData.exchangeRateArsPerUsd) : null

  const isProfitView = title.toLowerCase().includes('ganancia') || title.toLowerCase().includes('profit')

  if (!isOpen) return null

  const currencySymbol = {
    ARS: '$',
    USD: 'U$S',
  }

  return (
    <div className="modal-overlay flex items-center justify-center p-4 sm:p-6">
      <div className="relative mx-auto flex min-h-[280px] max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-adaptive bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-slate-950/95">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-adaptive">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {title}
            </h3>
            {period && (
              <p className="text-slate-400 text-sm mt-1">
                {period.label} • {new Date(period.start).toLocaleDateString('es-AR')} a{' '}
                {new Date(period.end).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <div className="space-y-6">
              {summary && (
                <div className="grid gap-3 lg:grid-cols-4 mb-6">
                  <div className="surface-secondary rounded-3xl border border-adaptive p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-adaptive-secondary font-semibold">Ingresos ARS</p>
                    <p className="mt-3 text-xl font-semibold text-adaptive-primary">{formatCurrency(summary.salesArs, 'ARS')}</p>
                  </div>
                  <div className="surface-secondary rounded-3xl border border-adaptive p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-adaptive-secondary font-semibold">Ingresos USD</p>
                    <p className="mt-3 text-xl font-semibold text-adaptive-primary">{formatCurrency(summary.salesUsd, 'USD')}</p>
                  </div>
                  <div className="surface-secondary rounded-3xl border border-adaptive p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-adaptive-secondary font-semibold">Ganancia ARS</p>
                    <p className="mt-3 text-xl font-semibold text-adaptive-primary">{formatCurrency(summary.profitArs, 'ARS')}</p>
                  </div>
                  <div className="surface-secondary rounded-3xl border border-adaptive p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-adaptive-secondary font-semibold">Ganancia USD</p>
                    <p className="mt-3 text-xl font-semibold text-adaptive-primary">{formatCurrency(summary.profitUsd, 'USD')}</p>
                  </div>
                </div>
              )}

              {error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-red-500">
                  <AlertCircle className="h-12 w-12 opacity-50 mb-4" />
                  <p className="font-medium text-lg">Hubo un problema</p>
                  <p className="text-sm opacity-80">{error.message}</p>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : deals && deals.length > 0 ? (
                <div className="space-y-4">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="group flex flex-col gap-4 rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900 dark:hover:border-slate-700"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Columna izquierda */}
                        <div className="space-y-3">
                          {/* Código de unidad */}
                          <div>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Unidad
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="font-mono">
                                {deal.unitCode}
                              </Badge>
                              {deal.unitModel && (
                                <span className="text-sm text-muted-foreground">{deal.unitModel}</span>
                              )}
                            </div>
                          </div>

                          {/* Vendedor */}
                          <div>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Vendedor
                            </p>
                            <p className="text-sm font-medium mt-1">{deal.sellerName}</p>
                          </div>

                          {/* Comprador */}
                          {deal.buyerName && (
                            <div>
                              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                                Comprador
                              </p>
                              <div className="mt-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{deal.buyerName}</p>
                                {deal.buyerPhone && (
                                  <p className="text-xs text-slate-500">{deal.buyerPhone}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Columna derecha */}
                        <div className="space-y-3">
                          {/* Valor de venta */}
                          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800 relative group/edit">
                            <div className="flex justify-between items-start">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                Valor de Venta
                              </p>
                              {(userRole === 'ADMIN' || userRole === 'MANAGER' || (userRole === 'SELLER' && deal.sellerId !== undefined)) && (
                                <button
                                  onClick={() => setEditingDeal(deal)}
                                  className="opacity-0 group-hover/edit:opacity-100 transition-opacity bg-white/80 dark:bg-slate-900/80 p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                                  title="Corregir Valor"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                                {currencySymbol[deal.currency as keyof typeof currencySymbol] || deal.currency}
                                {' '}
                                {formatCurrency(deal.finalPrice, deal.currency as 'ARS' | 'USD')}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {deal.currency}
                              </Badge>
                            </div>
                            {(() => {
                              // If global config has exchange rate, use it instead of 1.00
                              const effectiveExchangeRate = (deal.exchangeRate === 1 && globalExchangeRate) 
                                ? globalExchangeRate 
                                : globalExchangeRate || deal.exchangeRate

                              return deal.currency === 'USD' ? (
                                <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                                  <p>
                                    Equivale a <strong>{formatCurrency(deal.finalPrice * effectiveExchangeRate, 'ARS')}</strong> con tipo de cambio <strong>{effectiveExchangeRate.toFixed(2)} ARS/USD</strong>
                                  </p>
                                  <p>
                                    Precio original: <strong>{formatCurrency(deal.finalPrice, 'USD')}</strong>
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Tipo de cambio actual: {effectiveExchangeRate.toFixed(2)} ARS/USD
                                </p>
                              )
                            })()}
                          </div>

                          {/* Info de Rentabilidad (Solo visible en Ganancia Neta y si hay costos cargados) */}
                          {isProfitView && (deal.unitCostArs || deal.unitCostUsd) && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                Rentabilidad de la Operación
                              </p>
                              {(() => {
                                const effectiveRate = (deal.exchangeRate === 1 && globalExchangeRate) ? globalExchangeRate : (globalExchangeRate || deal.exchangeRate || 1000)
                                const dealTotalArs = deal.currency === 'USD' ? deal.finalPrice * effectiveRate : deal.finalPrice
                                const dealTotalUsd = deal.currency === 'USD' ? deal.finalPrice : deal.finalPrice / effectiveRate
                                
                                const costArs = deal.unitCostArs || (deal.unitCostUsd ? deal.unitCostUsd * effectiveRate : 0)
                                const costUsd = deal.unitCostUsd || (deal.unitCostArs ? deal.unitCostArs / effectiveRate : 0)
                                
                                const profitArs = dealTotalArs - costArs
                                const profitUsd = dealTotalUsd - costUsd

                                return (
                                  <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Costo Unidad</p>
                                      <p className="text-sm font-semibold">
                                        {deal.unitCostUsd ? `U$S ${formatCurrency(costUsd, 'USD')}` : `$ ${formatCurrency(costArs, 'ARS')}`}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ganancia Neta</p>
                                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {deal.currency === 'USD' 
                                          ? `U$S ${formatCurrency(profitUsd, 'USD')}` 
                                          : `$ ${formatCurrency(profitArs, 'ARS')}`}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Fechas */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Entregada
                              </p>
                              <p className="text-xs mt-1 font-mono">
                                {new Date(deal.deliveredAt).toLocaleDateString('es-AR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Hora
                              </p>
                              <p className="text-xs mt-1 font-mono">
                                {new Date(deal.deliveredAt).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divisor */}
                      <div className="border-t mt-4 pt-3 flex items-center justify-between">
                        <Badge variant="outline" className="text-xs border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {deal.status}
                        </Badge>
                        <code className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{deal.id}</code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 font-medium">Sin operaciones en este período</p>
                </div>
              )}
          </div>
        </div>

        {/* Footer con contador */}
        {deals && (
          <div className="border-t border-adaptive px-5 py-3 flex items-center justify-between text-sm text-adaptive-secondary bg-slate-50 dark:bg-slate-900">
            <span>Total de operaciones: {deals.length}</span>
          </div>
        )}
      </div>

      {editingDeal && (
        <EditDealValueModal
          isOpen={!!editingDeal}
          onClose={() => setEditingDeal(null)}
          deal={{
            id: editingDeal.id,
            unitCode: editingDeal.unitCode,
            finalPrice: editingDeal.finalPrice,
            currency: editingDeal.currency,
            exchangeRate: editingDeal.exchangeRate || 1,
          }}
          onSuccess={() => {
            if (onDealUpdated) onDealUpdated()
          }}
        />
      )}
    </div>
  )
}
