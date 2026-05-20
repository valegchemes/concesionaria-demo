/**
 * Modal de detalles de costos
 * Muestra el desglose detallado de los ítems asociados a una categoría
 * Totalmente adaptado al sistema de temas de la aplicación (superficies y texto adaptativo)
 */

'use client'

import { X, Receipt, Calendar, Info, Car } from 'lucide-react'
import { formatCurrency } from '@/lib/domains/analytics/hooks'
import { CostItemDetail } from '@/lib/domains/analytics/types'

interface CostDetailsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  categoryName: string
  items: CostItemDetail[]
  timeRangeLabel?: string
}

export function CostDetailsModal({
  isOpen,
  onOpenChange,
  categoryName,
  items,
  timeRangeLabel,
}: CostDetailsModalProps) {
  if (!isOpen) return null

  // Calcular totales
  const totalArs = items.reduce((sum, item) => sum + item.amountArs, 0)
  const totalUsd = items.reduce((sum, item) => sum + item.amountUsd, 0)

  return (
    <div className="modal-overlay flex items-start justify-center p-6">
      <div className="relative mx-auto flex min-h-[280px] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-adaptive shadow-2xl backdrop-blur-xl my-10 surface-primary">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-adaptive">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-500" />
              Desglose de Costos: {categoryName}
            </h3>
            {timeRangeLabel && (
              <p className="text-slate-400 text-sm mt-1 font-medium">
                Período: {timeRangeLabel}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto max-h-[60vh] scrollbar-thin">
            <div className="p-5">
              {/* Totales Resumen */}
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="surface-secondary rounded-2xl border border-adaptive p-4">
                  <p className="text-xs uppercase tracking-wider text-adaptive-secondary font-semibold">Total en Pesos (ARS)</p>
                  <p className="mt-2 text-2xl font-black text-adaptive-primary">{formatCurrency(totalArs, 'ARS')}</p>
                </div>
                <div className="surface-secondary rounded-2xl border border-adaptive p-4">
                  <p className="text-xs uppercase tracking-wider text-adaptive-secondary font-semibold">Total en Dólares (USD)</p>
                  <p className="mt-2 text-2xl font-black text-adaptive-primary">{formatCurrency(totalUsd, 'USD')}</p>
                </div>
              </div>

              {/* Items List */}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const hasVehicle = item.reference && item.reference !== 'Gasto General' && item.reference !== 'Gasto en Unidad' && item.reference !== 'Operación de venta'

                    return (
                      <div
                        key={`${item.concept}-${item.date}-${idx}`}
                        className="surface-secondary border border-adaptive rounded-2xl p-4 hover:bg-slate-500/5 transition-colors shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Izquierda: Info Gasto */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-adaptive-primary truncate">
                                {item.concept}
                              </span>
                              {item.reference && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold surface-muted border border-adaptive text-adaptive-primary">
                                  {hasVehicle && <Car className="h-3 w-3 inline mr-0.5 text-adaptive-secondary" />}
                                  {item.reference}
                                </span>
                              )}
                            </div>
                            
                            {item.description && (
                              <p className="text-xs text-adaptive-secondary surface-muted p-2 rounded-lg border border-adaptive flex items-start gap-1">
                                <Info className="h-3.5 w-3.5 mt-0.5 text-adaptive-secondary shrink-0" />
                                <span>{item.description}</span>
                              </p>
                            )}

                            <div className="flex items-center gap-1.5 text-xs text-adaptive-secondary">
                              <Calendar className="h-3.5 w-3.5 text-adaptive-secondary" />
                              <span>
                                {new Date(item.date).toLocaleDateString('es-AR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Derecha: Importe */}
                          <div className="text-right shrink-0 surface-muted px-4 py-2.5 rounded-xl border border-adaptive min-w-[160px]">
                            {item.amountArs > 0 && (
                              <div className="font-extrabold text-sm text-adaptive-primary">
                                {formatCurrency(item.amountArs, 'ARS')}
                              </div>
                            )}
                            {item.amountUsd > 0 && (
                              <div className="font-bold text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                {formatCurrency(item.amountUsd, 'USD')}
                              </div>
                            )}
                            {item.amountArs === 0 && item.amountUsd === 0 && (
                              <span className="text-xs text-adaptive-secondary italic">Sin importe</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-adaptive rounded-3xl">
                  <p className="text-adaptive-secondary text-sm">No hay ítems registrados en este período.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-adaptive px-5 py-3.5 flex items-center justify-between text-xs text-adaptive-secondary bg-slate-900/5 dark:bg-slate-950/20">
          <span>Registros encontrados: {items.length}</span>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[11px] font-bold text-adaptive-secondary hover:text-adaptive-primary uppercase tracking-wider transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
