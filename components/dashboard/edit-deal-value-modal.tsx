'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Save, Calculator } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EditDealValueModalProps {
  isOpen: boolean
  onClose: () => void
  deal: {
    id: string
    unitCode: string
    finalPrice: number
    currency: string
    exchangeRate: number
  }
  onSuccess?: () => void
}

export function EditDealValueModal({ isOpen, onClose, deal, onSuccess }: EditDealValueModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  function formatWithDots(raw: string | number): string {
    const rawStr = typeof raw === 'number' ? raw.toString() : raw
    const digits = rawStr.replace(/\D/g, '')
    if (!digits) return ''
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(digits))
  }

  function parseFormatted(formatted: string): number {
    const clean = formatted.replace(/[^\d]/g, '')
    return clean ? Number(clean) : 0
  }

  const [finalPrice, setFinalPrice] = useState(formatWithDots(deal.finalPrice))
  const [currency, setCurrency] = useState(deal.currency)
  const [exchangeRate, setExchangeRate] = useState(formatWithDots(deal.exchangeRate))

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        finalPrice: parseFormatted(finalPrice),
        finalPriceCurrency: currency,
        exchangeRate: parseFormatted(exchangeRate),
      }

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Error al actualizar la operación')
      }

      toast.success('Valor de la operación actualizado correctamente')
      if (onSuccess) onSuccess()
      onClose()
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo actualizar el valor')
    } finally {
      setIsSubmitting(false)
    }
  }

  const parsedFinalPrice = parseFormatted(finalPrice)
  const parsedExchangeRate = parseFormatted(exchangeRate)
  const calculatedArs = currency === 'USD' ? parsedFinalPrice * parsedExchangeRate : parsedFinalPrice

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Corregir Valor de Venta
            </h2>
            <p className="text-xs text-slate-500 mt-1">Unidad: {deal.unitCode}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-900"
                disabled={isSubmitting}
              >
                <option value="ARS">ARS - Pesos</option>
                <option value="USD">USD - Dólares</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Monto Final
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(formatWithDots(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-900"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className={cn("space-y-2 transition-opacity", currency === 'ARS' ? "opacity-50 pointer-events-none" : "opacity-100")}>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
              <span>Tipo de Cambio</span>
              <span className="text-slate-400">ARS / USD</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                required={currency === 'USD'}
                value={exchangeRate}
                onChange={(e) => setExchangeRate(formatWithDots(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-800 dark:bg-slate-900"
                disabled={isSubmitting || currency === 'ARS'}
              />
            </div>
          </div>

          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-4 border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400">
              <Calculator className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Total Calculado para Analíticas</span>
            </div>
            <p className="text-2xl font-black text-indigo-900 dark:text-indigo-300">
              $ {new Intl.NumberFormat('es-AR').format(calculatedArs)} <span className="text-sm font-medium">ARS</span>
            </p>
            {currency === 'USD' && (
              <p className="text-xs mt-1 text-indigo-600/70 dark:text-indigo-400/70">
                (Al tipo de cambio de {exchangeRate})
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
