/**
 * Modal de detalles de operaciones
 * Muestra lista completa de deals con información detallada
 */

'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/domains/analytics/hooks'
import { DollarSign, User, Calendar, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

export function DealDetailsModal({
  isOpen,
  onOpenChange,
  title,
  deals,
  isLoading = false,
  timeRange = '30d',
  period,
}: DealDetailsModalProps) {
  const currencySymbol = {
    ARS: '$',
    USD: 'U$S',
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            {title}
          </DialogTitle>
          {period && (
            <p className="text-xs text-muted-foreground mt-2">
              {period.label} • {new Date(period.start).toLocaleDateString('es-AR')} a{' '}
              {new Date(period.end).toLocaleDateString('es-AR')}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : deals && deals.length > 0 ? (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
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
                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                              Comprador
                            </p>
                            <div className="mt-1">
                              <p className="text-sm font-medium">{deal.buyerName}</p>
                              {deal.buyerPhone && (
                                <p className="text-xs text-muted-foreground">{deal.buyerPhone}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Columna derecha */}
                      <div className="space-y-3">
                        {/* Valor de venta */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                            Valor de Venta
                          </p>
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                              {currencySymbol[deal.currency as keyof typeof currencySymbol] || deal.currency}
                              {' '}
                              {formatCurrency(deal.finalPrice, deal.currency)}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {deal.currency}
                            </Badge>
                          </div>
                          {deal.currency === 'USD' && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Tipo de cambio: ${deal.exchangeRate.toFixed(2)} ARS/USD
                            </p>
                          )}
                        </div>

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
                    <div className="border-t mt-3 pt-3 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {deal.status}
                      </Badge>
                      <code className="text-[10px] text-muted-foreground">{deal.id}</code>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-sm">Sin operaciones en este período</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer con contador */}
        {deals && (
          <div className="border-t pt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Total de operaciones: {deals.length}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
