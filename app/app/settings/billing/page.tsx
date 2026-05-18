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
import { Loader2, ShoppingCart, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react'

interface Plan {
  id: string
  name: string
  description?: string | null
  stripePriceId: string
  price: string
  currency: string
  interval: string
  maxUsers: number
  maxUnits: number
  analyticsEnabled: boolean
  whatsappEnabled: boolean
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
        <h1 className="text-2xl font-bold tracking-tight text-adaptive-primary">Suscripción</h1>
        <p className="text-adaptive-secondary">
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
        <Card className="border-l-4 border-l-blue-500 surface-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-adaptive-primary">Suscripción actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-adaptive-secondary">
            <div className="flex items-center gap-2">
              Estado:{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </div>
            {subscription.plan?.name && (
              <div className="text-adaptive-primary">Plan: <strong>{subscription.plan.name}</strong></div>
            )}
            {subscription.currentPeriodEnd && (
              <div className="text-adaptive-secondary">
                Próxima renovación:{' '}
                <strong className="text-adaptive-primary">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-AR')}
                </strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isFetching ? (
          <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md col-span-3">
            Cargando planes...
          </div>
        ) : plans.length === 0 && !error ? (
          <div className="p-4 bg-gray-50 text-gray-700 border border-gray-200 rounded-md col-span-3">
            No hay planes disponibles en este momento. Por favor contacta a soporte.
          </div>
        ) : (
          <>
            {plans.map((plan, idx) => {
              const isPro = plan.name.toLowerCase().includes('pro')
              return (
                <Card key={plan.id} className={`flex flex-col relative surface-secondary transition-all ${
                  isPro ? 'border-2 border-violet-500 shadow-xl shadow-violet-900/20 md:-translate-y-2' : ''
                }`}>
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-violet-600 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md">
                        Recomendado
                      </span>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className={`h-5 w-5 ${isPro ? 'text-violet-500' : 'text-blue-500'}`} />
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                    </div>
                    <div className="flex items-baseline mt-2">
                      <span className="text-3xl font-black text-adaptive-primary">
                        ${Number(plan.price).toLocaleString('es-AR')}
                      </span>
                      <span className="text-sm font-medium text-adaptive-secondary ml-1.5">ARS / mes</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4 mt-2">
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {plan.maxUsers === 1 ? '1 usuario incluido' : `Hasta ${plan.maxUsers} usuarios`}
                      </li>
                      <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        Hasta {plan.maxUnits} unidades en inventario
                      </li>
                      {plan.analyticsEnabled && (
                        <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          Analíticas de ventas avanzadas
                        </li>
                      )}
                      {plan.whatsappEnabled && (
                        <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          Envío automático por WhatsApp
                        </li>
                      )}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => handleCheckout(plan.stripePriceId)}
                      disabled={loading}
                      className={`w-full font-semibold ${
                        isPro ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''
                      }`}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        'Pagar con Mercado Pago'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
            
            {/* Enterprise Plan Card */}
            <Card className="flex flex-col relative surface-muted border-dashed border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-xl">Plan Enterprise</CardTitle>
                </div>
                <div className="flex items-baseline mt-2">
                  <span className="text-2xl font-bold text-adaptive-primary">
                    A convenir
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 mt-2">
                <p className="text-sm text-adaptive-secondary">
                  Para concesionarias con operaciones a gran escala que requieren soluciones a medida.
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                    <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    Usuarios e Inventario Ilimitados
                  </li>
                  <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                    <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    Soporte Prioritario 24/7
                  </li>
                  <li className="flex items-start gap-2 text-adaptive-primary font-medium">
                    <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    Migración de datos incluida
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full font-semibold"
                  onClick={() => window.open('mailto:soporte@automanager.com', '_blank')}
                >
                  Contactar con Soporte
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
