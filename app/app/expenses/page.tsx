'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Wallet, Calculator, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/domains/analytics/hooks'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ExpenseSchema = z.object({
  category: z.string().min(1, 'Categoría requerida'),
  description: z.string().optional(),
  amountArs: z.coerce.number().min(0).default(0),
  amountUsd: z.coerce.number().min(0).default(0),
  date: z.string().min(1, 'Fecha requerida'),
})

type ExpenseFormData = z.infer<typeof ExpenseSchema>

interface Expense {
  id: string
  category: string
  description: string | null
  amountArs: number
  amountUsd: number
  date: string
}

// Íconos por categoría de gasto
function getCategoryEmoji(category: string): string {
  const lower = category.toLowerCase()
  if (lower.includes('luz') || lower.includes('energia') || lower.includes('electricidad')) return '💡'
  if (lower.includes('alquiler') || lower.includes('renta') || lower.includes('local')) return '🏠'
  if (lower.includes('sueldo') || lower.includes('vendedor') || lower.includes('personal') || lower.includes('pago')) return '👤'
  if (lower.includes('agua')) return '💧'
  if (lower.includes('gas')) return '🔥'
  if (lower.includes('internet') || lower.includes('telefono') || lower.includes('celular')) return '📡'
  if (lower.includes('seguro')) return '🛡️'
  if (lower.includes('manten') || lower.includes('refacc') || lower.includes('repuesto')) return '🔧'
  if (lower.includes('publicidad') || lower.includes('marketing') || lower.includes('redes')) return '📢'
  if (lower.includes('limpieza')) return '🧹'
  if (lower.includes('comida') || lower.includes('cafe') || lower.includes('viatico')) return '☕'
  return '💼'
}

// Paleta de colores para el gráfico de torta
const PIE_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa',
  '#f59e0b', '#fb923c', '#f87171',
  '#34d399', '#22d3ee', '#60a5fa',
  '#e879f9', '#f472b6', '#a3e635',
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseFormData>({
    defaultValues: {
      amountArs: 0,
      amountUsd: 0,
      date: new Date().toISOString().split('T')[0],
    },
  })

  const fetchExpenses = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/expenses?month=${month}`)
      const data = await res.json()
      if (data.success) setExpenses(data.data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchExpenses() }, [month])

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) { reset(); fetchExpenses() }
      else alert(result.error)
    } catch {
      alert('Error guardando costo')
    }
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar este costo mensual?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) fetchExpenses()
    } catch {
      alert('Error eliminando costo')
    }
  }

  const totalArs = expenses.reduce((sum, e) => sum + Number(e.amountArs), 0)
  const totalUsd = expenses.reduce((sum, e) => sum + Number(e.amountUsd), 0)

  // Datos para el gráfico de torta (agrupado por categoría, solo ARS)
  const pieData = Object.values(
    expenses.reduce((acc: Record<string, { name: string; value: number }>, e) => {
      const key = e.category
      if (!acc[key]) acc[key] = { name: key, value: 0 }
      acc[key].value += Number(e.amountArs) || 0
      return acc
    }, {})
  ).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-rose-500" />
            Costos Mensuales
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de gastos operativos. Se descuentan automáticamente de la ganancia neta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Formulario */}
        <Card className="md:col-span-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-rose-500" />
              Nuevo Gasto
            </CardTitle>
            <CardDescription>Registra un costo manualmente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoría</Label>
                <Input {...register('category', { required: 'La categoría es obligatoria' })}
                  placeholder="Ej: Luz, Alquiler, Sueldos"
                  className="bg-white/60 dark:bg-slate-900/60" />
                {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Detalle (Opcional)</Label>
                <Input {...register('description')}
                  placeholder="Factura #1234"
                  className="bg-white/60 dark:bg-slate-900/60" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Monto ARS</Label>
                  <Input type="number" step="0.01" {...register('amountArs')}
                    className="bg-white/60 dark:bg-slate-900/60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Monto USD</Label>
                  <Input type="number" step="0.01" {...register('amountUsd')}
                    className="bg-white/60 dark:bg-slate-900/60" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fecha</Label>
                <Input type="date" {...register('date', { required: 'La fecha es obligatoria' })}
                  className="bg-white/60 dark:bg-slate-900/60" />
                {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
              </div>

              <Button type="submit" className="w-full gap-1.5" disabled={isSubmitting}>
                <Plus className="h-4 w-4" />
                {isSubmitting ? 'Guardando...' : 'Agregar Costo'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Panel derecho */}
        <div className="md:col-span-2 space-y-5">

          {/* Total del mes + Gráfico de torta */}
          <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                  Total del Mes
                </CardTitle>
                <CardDescription>Suma total del período seleccionado</CardDescription>
              </div>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44 bg-white/60 dark:bg-slate-900/60"
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  {totalArs > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total ARS</p>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatCurrency(totalArs, 'ARS')}
                      </p>
                    </div>
                  )}
                  {totalUsd > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total USD</p>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatCurrency(totalUsd, 'USD')}
                      </p>
                    </div>
                  )}
                  {totalArs === 0 && totalUsd === 0 && (
                    <p className="text-sm text-muted-foreground italic">Sin gastos este mes</p>
                  )}
                </div>

                {/* Gráfico de Torta */}
                {pieData.length > 0 && (
                  <div className="flex-1 min-w-[200px] h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* Desglose */}
          <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Desglose de Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Cargando costos...</div>
              ) : expenses.length === 0 ? (
                <div className="py-12 text-center">
                  <Wallet className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Sin costos en este mes</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Usa el formulario para registrar un gasto.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense, idx) => (
                    <div
                      key={expense.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border border-transparent transition-colors hover:border-slate-200 dark:hover:border-slate-700 ${idx % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl" role="img" aria-label={expense.category}>
                          {getCategoryEmoji(expense.category)}
                        </span>
                        <div>
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{expense.category}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{new Date(expense.date).toLocaleDateString('es-AR')}</span>
                            {expense.description && (
                              <><span>·</span><span>{expense.description}</span></>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {Number(expense.amountArs) > 0 && (
                            <p className="font-bold text-sm text-rose-600 dark:text-rose-400">
                              {formatCurrency(Number(expense.amountArs), 'ARS')}
                            </p>
                          )}
                          {Number(expense.amountUsd) > 0 && (
                            <p className="font-bold text-sm text-rose-600 dark:text-rose-400">
                              {formatCurrency(Number(expense.amountUsd), 'USD')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteExpense(expense.id)}
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
