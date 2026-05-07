'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react'

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
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [canceledMsg, setCanceledMsg] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (searchParams.get('success')) setSuccessMsg(true)
    if (searchParams.get('canceled')) setCanceledMsg(true)
  }, [searchParams])

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch('/api/billing/plans')
        const data = await res.json()

        if (res.ok && Array.isArray(data.plans)) {
          setPlans(data.plans)
        } else {
          setError(data.error || 'No se pudieron cargar los planes')
        }
      } catch {
        setError('Error al cargar los planes')
      }
    }

    loadPlans()
  }, [])

  async function handleCheckout(priceId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error: ' + data.error)
      }
    } catch (e) {
      alert('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handlePortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Error: ' + data.error)
      }
    } catch (e) {
      alert('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suscripción SaaS</h1>
        <p className="text-muted-foreground">
          Gestiona tu plan activo y métodos de pago.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          ¡Gracias! Tu suscripción se ha actualizado correctamente.
        </div>
      )}
      {canceledMsg && (
        <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md">
          El proceso de pago fue cancelado. No se han realizado cargos.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {plans.length === 0 && !error ? (
            <div className="p-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md">
              Cargando planes...
            </div>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {plan.currency.toUpperCase()} {plan.price.toString()} / {plan.interval}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">{plan.description || 'Plan de suscripción gestionado por Stripe'}</p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Hasta {plan.maxUsers} usuarios</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Hasta {plan.maxUnits} unidades</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleCheckout(plan.stripePriceId)} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Suscribirse Ahora'}
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>

        {/* Panel de Gestión (Stripe Portal) */}
        <Card>
          <CardHeader>
            <CardTitle>Portal de Facturación</CardTitle>
            <CardDescription>Descarga tus facturas, cambia de tarjeta o cancela tu plan.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-gray-500">
               Serás redirigido al portal seguro de Stripe para autogestionar tus formas de pago.

             </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handlePortal} disabled={loading} variant="outline" className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Ir al Portal Seguro'}
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}
