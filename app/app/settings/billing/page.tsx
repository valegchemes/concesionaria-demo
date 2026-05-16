'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingCart, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface Plan {
  id: string
  name: string
  description?: string | null
  stripePriceId: string // reused field — stores MP plan ID
  price: string
  currency: string
  interval: string
  maxUsers: number
  maxUnits: number
}

interface Subscription {
  status: string
  currentPeriodEnd: string | null
  mpPaymentId: string | null
  plan?: { name: string } | null
}

const statusBadge: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Activa', color: 'bg-green-100 text-green-800' },
  INCOMPLETE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  PAUSED: { label: 'Pausada', color: 'bg-blue-100 text-blue-800' },
  CANCELED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  PAST_DUE: { label: 'Vencida', color: 'bg-orange-100 text-orange-800' },
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [pendingMsg, setPendingMsg] = useState(false)
  const [canceledMsg, setCanceledMsg] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    if (searchParams.get('success')) setSuccessMsg(true)
    if (searchParams.get('canceled')) setCanceledMsg(true)
    if (searchParams.get('pending')) setPendingMsg(true)
  }, [searchParams])

  useEffect(() => {
    async function loadData() {
      setIsFetching(true)
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch('/api/billing/plans'),
          fetch('/api/billing/portal'),
        ])
        const plansData = await plansRes.json()
        const subData = await subRes.json()

        if (plansRes.ok && Array.isArray(plansData.plans)) {
          setPlans(plansData.plans)
        } else {
          setError(plansData.error || 'No se pudieron cargar los planes')
        }

        if (subRes.ok && subData.subscription) {
          setSubscription(subData.subscription)
        }
      } catch {
        setError('Error al cargar los datos de facturación')
      } finally {
        setIsFetching(false)
      }
    }
    loadData()
  }, [])

  async function handleCheckout(priceId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de red. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const currentStatus = subscription ? statusBadge[subscription.status] : null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suscripción</h1>
        <p className="text-muted-foreground">
          Gestiona tu plan. Los pagos son procesados de forma segura por{' '}
          <strong>Mercado Pago</strong>.
        </p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          ¡Gracias! Tu pago fue aprobado y tu suscripción está activa.
        </div>
      )}
      {pendingMsg && (
        <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md flex items-center gap-2">
          <Clock className="h-5 w-5 shrink-0" />
          Tu pago está siendo procesado. Recibirás una confirmación en breve.
        </div>
      )}
      {canceledMsg && (
        <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          El proceso de pago fue cancelado. No se realizó ningún cargo.
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* Current subscription status */}
      {subscription && currentStatus && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suscripción actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              Estado:{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </div>
            {subscription.plan?.name && (
              <div>Plan: <strong>{subscription.plan.name}</strong></div>
            )}
            {subscription.currentPeriodEnd && (
              <div>
                Próxima renovación:{' '}
                <strong>
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-AR')}
                </strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isFetching ? (
          <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md col-span-2">
            Cargando planes...
          </div>
        ) : plans.length === 0 && !error ? (
          <div className="p-4 bg-gray-50 text-gray-700 border border-gray-200 rounded-md col-span-2">
            No hay planes disponibles en este momento. Por favor contacta a soporte.
          </div>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <CardTitle>{plan.name}</CardTitle>
                </div>
                <CardDescription>
                  {plan.currency.toUpperCase()} {Number(plan.price).toLocaleString('es-AR')} /{' '}
                  {plan.interval === 'month' ? 'mes' : plan.interval}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-sm text-gray-600">
                  {plan.description || 'Plan de suscripción mensual'}
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    Hasta {plan.maxUsers} usuarios
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    Hasta {plan.maxUnits} unidades en inventario
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleCheckout(plan.stripePriceId)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Pagar con Mercado Pago'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
