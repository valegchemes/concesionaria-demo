'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react'

// Dummy plan para Phase 1. En Fase 2 vendrá de la tabla SaasPlan
const STARTER_PLAN_PRICE_ID = 'price_fake_test_id'

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [canceledMsg, setCanceledMsg] = useState(false)
  
  // Realmente en una app completa harías fetch a un endpoint
  // GET /api/billing/status para ver el current status antes de mostrar
  // Pero para MVP asumimos vista genérica:

  useEffect(() => {
    if (searchParams.get('success')) setSuccessMsg(true)
    if (searchParams.get('canceled')) setCanceledMsg(true)
  }, [searchParams])

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: STARTER_PLAN_PRICE_ID })
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel de Upgrade / Planes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              <CardTitle>Plan Starter</CardTitle>
            </div>
            <CardDescription>$49 USD / mes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <ul className="space-y-2 text-sm text-gray-600">
               <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Hasta 2 usuarios</li>
               <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Hasta 50 unidades</li>
               <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Catálogo público</li>
               <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500"/> Soporte por email</li>
             </ul>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCheckout} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Suscribirse Ahora'}
            </Button>
          </CardFooter>
        </Card>

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
