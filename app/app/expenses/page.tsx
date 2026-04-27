'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Wallet, Calculator } from 'lucide-react'
import { formatCurrency } from '@/lib/domains/analytics/hooks'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const ExpenseSchema = z.object({
  category: z.string().min(1, 'Categoría requerida'),
  description: z.string().optional(),
  amountArs: z.coerce.number().min(0).default(0),
  amountUsd: z.coerce.number().min(0).default(0),
  date: z.string().min(1, 'Fecha requerida')
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseFormData>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: {
      amountArs: 0,
      amountUsd: 0,
      date: new Date().toISOString().split('T')[0]
    }
  })

  const fetchExpenses = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/expenses?month=${month}`)
      const data = await res.json()
      if (data.success) {
        setExpenses(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [month])

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()
      if (result.success) {
        reset()
        fetchExpenses()
      } else {
        alert(result.error)
      }
    } catch (e) {
      alert('Error guardando costo')
    }
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar este costo mensual?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchExpenses()
      }
    } catch (e) {
      alert('Error eliminando costo')
    }
  }

  const totalArs = expenses.reduce((sum, e) => sum + Number(e.amountArs), 0)
  const totalUsd = expenses.reduce((sum, e) => sum + Number(e.amountUsd), 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight dark:text-white flex items-center gap-2">
          <Wallet className="h-8 w-8 text-blue-500" />
          Costos Mensuales
        </h1>
        <p className="text-muted-foreground mt-1">
          Lleva la cuenta de mantenimiento, sueldos y servicios. Estos costos se descontarán de la ganancia neta en tu Dashboard automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Formulario */}
        <Card className="md:col-span-1 dark:bg-slate-950/60 dark:border-slate-800 transition-colors duration-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
              <Calculator className="h-5 w-5" />
              Nuevo Gasto
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Registra un costo manualmente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Categoría</Label>
                <Input {...register('category')} placeholder="Ej: Luz, Alquiler, Mantenimiento" className="dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-300">Detalle (Opcional)</Label>
                <Input {...register('description')} placeholder="Factura #1234" className="dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Monto ARS</Label>
                  <Input type="number" step="0.01" {...register('amountArs')} className="dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Monto USD</Label>
                  <Input type="number" step="0.01" {...register('amountUsd')} className="dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-300">Fecha</Label>
                <Input type="date" {...register('date')} className="dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Agregar Costo'}
                <Plus className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Gastos */}
        <div className="md:col-span-2 space-y-6">
          <Card className="dark:bg-slate-950/60 dark:border-slate-800 transition-colors duration-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl dark:text-white">Total del Mes</CardTitle>
                <CardDescription className="dark:text-slate-400">Suma total del periodo seleccionado</CardDescription>
              </div>
              <Input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-slate-400">Total Pesos (ARS)</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(totalArs, 'ARS')}
                  </p>
                </div>
                {totalUsd > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground dark:text-slate-400">Total Dólares (USD)</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(totalUsd, 'USD')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-950/60 dark:border-slate-800 transition-colors duration-500">
            <CardHeader>
              <CardTitle className="dark:text-white">Desglose de Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Cargando costos...</div>
              ) : expenses.length === 0 ? (
                <div className="py-12 text-center">
                  <Wallet className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="text-lg font-medium text-slate-500 dark:text-slate-400">Sin costos en este mes</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Usa el formulario para registrar un mantenimiento o servicio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses.map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-4 rounded-lg border dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                      <div>
                        <p className="font-medium dark:text-slate-200">{expense.category}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-slate-400">
                          <span>{new Date(expense.date).toLocaleDateString('es-AR')}</span>
                          {expense.description && (
                            <>
                              <span>&bull;</span>
                              <span>{expense.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {Number(expense.amountArs) > 0 && (
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(Number(expense.amountArs), 'ARS')}
                            </p>
                          )}
                          {Number(expense.amountUsd) > 0 && (
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(Number(expense.amountUsd), 'USD')}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-4 w-4" />
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
