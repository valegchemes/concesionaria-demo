'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubscriptionGuard({ 
  status,
  children 
}: { 
  status: string | null
  children: React.ReactNode 
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isBlocked, setIsBlocked] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    const inactiveStatuses = ['PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED', 'INCOMPLETE']
    // Tratar null como inactivo (no hay suscripción) — si no hay status, no hay acceso
    const isInactive = !status || inactiveStatuses.includes(status)
    const isBillingPage = pathname?.startsWith('/app/settings/billing')

    if (mountedRef.current) {
      if (isInactive && !isBillingPage) {
        setIsBlocked(true)
      } else {
        setIsBlocked(false)
      }
    }
    return () => { mountedRef.current = false }
  }, [status, pathname])

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-red-200 dark:border-red-900/50">
          <div className="bg-red-500 p-6 flex flex-col items-center justify-center text-white text-center">
            <AlertCircle className="h-16 w-16 mb-3" />
            <h2 className="text-2xl font-bold">Suscripción Inactiva</h2>
            <p className="mt-2 text-red-50 font-medium">
              El acceso a tu panel ha sido suspendido temporalmente.
            </p>
          </div>
          <div className="p-6 text-center space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Detectamos un problema con el pago o el estado de tu suscripción. 
              Para continuar utilizando el sistema, por favor actualizá o renová tu plan.
            </p>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={() => {
                setIsBlocked(false)
                router.push('/app/settings/billing?expired=true')
              }}
            >
              Ir a Facturación y Planes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
