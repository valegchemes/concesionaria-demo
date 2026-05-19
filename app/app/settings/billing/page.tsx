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
import { Loader2, ShoppingCart, CheckCircle2, Clock, AlertCircle, Building2, X, Sparkles } from 'lucide-react'

const planDescriptions: Record<string, { subtitle: string; badge: string; detailedFeatures: string[] }> = {
  'Plan Básico': {
    subtitle: 'La opción ideal para gestores independientes y agencias pequeñas que inician su digitalización.',
    badge: 'Inicio Rápido',
    detailedFeatures: [
      'Acceso exclusivo para 1 usuario administrador.',
      'Gestión ágil de inventario de hasta 15 vehículos activos.',
      'Ficha técnica descargable de tus vehículos para enviar a prospectos.',
      'Embudo de ventas simplificado para leads e interesados.',
      'Actualizaciones automáticas del sistema.',
    ]
  },
  'Plan Medio': {
    subtitle: 'Diseñado para concesionarias en crecimiento que necesitan control financiero y trabajo en equipo.',
    badge: 'Crecimiento Comercial',
    detailedFeatures: [
      'Soporte de hasta 3 usuarios concurrentes para tu equipo.',
      'Gestión ampliada de inventario para hasta 40 vehículos.',
      'Analíticas y reportes dinámicos de rendimiento de ventas.',
      'Cálculo exacto de márgenes de ganancias, comisiones y costos por unidad.',
      'Ficha técnica y cotizaciones descargables en formato PDF.',
      'Módulo de costos mensuales y gastos administrativos integrados.',
      'Módulo de Auditoría avanzada del sistema para control de acciones.',
    ]
  },
  'Plan Pro': {
    subtitle: 'La herramienta definitiva y profesional para concesionarias líderes que buscan automatización total.',
    badge: 'Todo Incluido / Premium',
    detailedFeatures: [
      'Acceso completo de hasta 8 usuarios para todo tu personal.',
      'Hasta 100 vehículos activos simultáneos en catálogo.',
      'Carga exprés de stock con IA (escaneo inteligente de cédulas y autofill).',
      'Cotizador interactivo de financiación (sistema francés) y propuestas PDF.',
      'Checklist y semáforo dinámico de Gestoría legal para transferencias.',
      'Diagnósticos financieros avanzados de ROI y Margen Neto Real.',
      'Envío inteligente y automatizado por WhatsApp (normalización UTF-8 libre de caracteres rotos).',
      'Generación inteligente de Pagarés, cálculo automatizado de cuotas e historial de cobranza.',
      'Boletos de compraventa, contratos de consignación y recibos de pago con firma digital.',
      'Analíticas avanzadas y tableros financieros completos (márgenes brutos y netos).',
      'Módulo de Auditoría avanzada del sistema para control de acciones.',
      'Soporte prioritario exclusivo y configuraciones avanzadas del tenant.',
    ]
  }
}

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
  documentsEnabled: boolean
  auditEnabled: boolean
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
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<Plan | null>(null)

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
              const nameLower = plan.name.toLowerCase()
              const isPro = nameLower.includes('pro')
              const isMedio = nameLower.includes('medio')
              const isBasico = nameLower.includes('básico') || nameLower.includes('basico')

              return (
                <Card 
                  key={plan.id} 
                  onClick={() => setSelectedPlanForDetail(plan)}
                  className={`flex flex-col relative bg-white dark:bg-slate-900 border transition-all cursor-pointer select-none duration-300 hover:shadow-2xl hover:-translate-y-1.5 ${
                    isPro 
                      ? 'border-violet-500 ring-2 ring-violet-500/10 shadow-xl shadow-violet-900/5 dark:shadow-violet-950/20 md:-translate-y-2' 
                      : 'border-slate-200 dark:border-slate-800 shadow-md'
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                        Recomendado / Completo 🚀
                      </span>
                    </div>
                  )}

                  <CardHeader className="pb-4 pt-6 px-6 border-b border-slate-50 dark:border-slate-800/60">
                    {/* Unique Tier Benefit Highlight Badge */}
                    <div className="mb-2.5">
                      {isBasico && (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                          Digitalización Inicial
                        </span>
                      )}
                      {isMedio && (
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-900/50">
                          Control de Gastos y Equipo
                        </span>
                      )}
                      {isPro && (
                        <span className="bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800">
                          IA + Cotizador + Gestoría
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <ShoppingCart className={`h-5 w-5 ${isPro ? 'text-violet-500' : 'text-blue-500'}`} />
                      <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{plan.name}</CardTitle>
                    </div>

                    <div className="flex items-baseline mt-3">
                      <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                        ${Number(plan.price).toLocaleString('es-AR')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1.5">ARS / mes</span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-5 px-6">
                    <ul className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
                      <li className="flex items-start gap-2.5 font-medium">
                        <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span>
                          {plan.maxUsers === 1 ? (
                            <span><strong>1 usuario</strong> incluido</span>
                          ) : (
                            <span>Hasta <strong>{plan.maxUsers} usuarios</strong> concurrentes</span>
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5 font-medium">
                        <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span>Hasta <strong>{plan.maxUnits} unidades</strong> en stock</span>
                      </li>
                      {plan.analyticsEnabled && (
                        <li className="flex items-start gap-2.5 font-medium">
                          <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Márgenes de ganancia</strong> y costos</span>
                        </li>
                      )}
                      {plan.whatsappEnabled && (
                        <li className="flex items-start gap-2.5 font-medium">
                          <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Envío por WhatsApp</strong> automatizado</span>
                        </li>
                      )}
                      {plan.documentsEnabled && (
                        <>
                          <li className="flex items-start gap-2.5 font-medium">
                            <Sparkles className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                            <span className="text-violet-700 dark:text-violet-300 font-semibold">Carga de stock por IA (Escáner)</span>
                          </li>
                          <li className="flex items-start gap-2.5 font-medium">
                            <Sparkles className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                            <span className="text-violet-700 dark:text-violet-300 font-semibold">Cotizador interactivo y PDF</span>
                          </li>
                          <li className="flex items-start gap-2.5 font-medium">
                            <Sparkles className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                            <span className="text-violet-700 dark:text-violet-300 font-semibold">Checklist legal de Gestoría</span>
                          </li>
                          <li className="flex items-start gap-2.5 font-medium">
                            <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                            <span>Pagarés, cuotas y boletos</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </CardContent>

                  <CardFooter className="pb-6 pt-2 px-6">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCheckout(plan.stripePriceId)
                      }}
                      disabled={loading}
                      className={`w-full font-bold py-3 rounded-xl transition-all shadow-sm ${
                        isPro 
                          ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/10' 
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'
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
            <Card className="flex flex-col relative bg-slate-50 dark:bg-slate-900/40 border-dashed border-2 border-slate-300 dark:border-slate-700 shadow-md">
              <CardHeader className="pb-4 pt-6 px-6">
                <div className="mb-2.5">
                  <span className="bg-slate-200 dark:bg-slate-850 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                    Operaciones a Escala
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Plan Enterprise</CardTitle>
                </div>
                <div className="flex items-baseline mt-3">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    A convenir
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 pt-2 px-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Para concesionarias con operaciones a gran escala que requieren soluciones a medida.
                </p>
                <ul className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5 font-medium">
                    <CheckCircle2 className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>Usuarios e Inventario <strong>Ilimitados</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5 font-medium">
                    <CheckCircle2 className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>Soporte Prioritario <strong>24/7</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5 font-medium">
                    <CheckCircle2 className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>Migración de datos incluida</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="pb-6 pt-4 px-6">
                <Button
                  variant="outline"
                  className="w-full font-bold py-3 rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => window.open('mailto:soporte@automanager.com', '_blank')}
                >
                  Contactar con Soporte
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>

      {/* Modal de detalles de plan */}
      {selectedPlanForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-all duration-300">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-adaptive-dialog-bg p-6 shadow-2xl overflow-hidden surface-secondary animate-in fade-in zoom-in duration-200">
            {/* Background elements */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 mb-2">
                    <Sparkles className="h-3 w-3" />
                    {planDescriptions[selectedPlanForDetail.name]?.badge ?? 'Plan CRM'}
                  </span>
                  <h3 className="text-2xl font-bold text-adaptive-primary">{selectedPlanForDetail.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedPlanForDetail(null)}
                  className="rounded-full p-1.5 hover:bg-adaptive-hover text-adaptive-secondary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Subtitle / Description */}
              <p className="text-sm text-adaptive-secondary mt-3 leading-relaxed">
                {planDescriptions[selectedPlanForDetail.name]?.subtitle ?? selectedPlanForDetail.description ?? 'Explorá todos los beneficios integrados de este plan.'}
              </p>

              {/* Price section */}
              <div className="my-5 p-4 rounded-xl bg-muted/50 border border-border flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-adaptive-secondary uppercase tracking-wider font-bold block mb-0.5">Inversión Mensual</span>
                  <span className="text-3xl font-black text-adaptive-primary">
                    ${Number(selectedPlanForDetail.price).toLocaleString('es-AR')}
                  </span>
                  <span className="text-sm font-semibold text-adaptive-secondary ml-1">ARS</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-adaptive-secondary block font-bold uppercase tracking-wider mb-0.5">Facturación</span>
                  <span className="text-sm font-bold text-indigo-500 capitalize">{selectedPlanForDetail.interval === 'month' ? 'Mensual' : selectedPlanForDetail.interval}</span>
                </div>
              </div>

              {/* Detailed Features List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-adaptive-primary uppercase tracking-wider">¿Qué incluye este plan?</h4>
                <ul className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {(planDescriptions[selectedPlanForDetail.name]?.detailedFeatures ?? []).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-adaptive-primary font-medium">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons inside modal */}
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => setSelectedPlanForDetail(null)}
                  variant="outline"
                  className="flex-1 font-semibold"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    setSelectedPlanForDetail(null)
                    handleCheckout(selectedPlanForDetail.stripePriceId)
                  }}
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/20"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adquirir este Plan'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
