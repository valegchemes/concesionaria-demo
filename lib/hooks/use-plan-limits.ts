'use client'

import { useState, useEffect, useRef } from 'react'

export interface PlanLimits {
  planName: string
  maxUsers: number
  maxUnits: number
  analyticsEnabled: boolean
  whatsappEnabled: boolean
  documentsEnabled: boolean
  auditEnabled: boolean
  aiEnabled: boolean
  isActive: boolean
  currentUsers: number
  currentUnits: number
}

const DEFAULT_LIMITS: PlanLimits = {
  planName: 'Cargando...',
  maxUsers: 1,
  maxUnits: 5,
  analyticsEnabled: false,
  whatsappEnabled: false,
  documentsEnabled: false,
  auditEnabled: false,
  aiEnabled: false,
  isActive: false,
  currentUsers: 0,
  currentUnits: 0,
}

// Caché keyeada por companyId para evitar fuga cross-tenant: si el usuario A
// (tenant X, Plan Pro) se desloguea y entra el usuario B (tenant Y, Free) en la
// misma sesión SPA sin reload, antes B veía los límites de A porque la caché era
// una sola variable de módulo. Ahora guardamos el companyId junto con los datos
// y solo reusamos la caché si coincide el tenant actual.
interface CachedEntry {
  companyId: string
  limits: PlanLimits
}
let cachedEntry: CachedEntry | null = null

export function usePlanLimits(currentCompanyId?: string) {
  const [limits, setLimits] = useState<PlanLimits>(() => {
    // Solo usar caché si coincide el companyId actual.
    if (cachedEntry && currentCompanyId && cachedEntry.companyId === currentCompanyId) {
      return cachedEntry.limits
    }
    return DEFAULT_LIMITS
  })
  const [loading, setLoading] = useState(() => {
    // Ya hay caché válida para este tenant → no cargar.
    return !(cachedEntry && currentCompanyId && cachedEntry.companyId === currentCompanyId)
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    // Si hay caché válida para el tenant actual, usarla.
    if (cachedEntry && currentCompanyId && cachedEntry.companyId === currentCompanyId) {
      if (mountedRef.current) {
        setLimits(cachedEntry.limits)
        setLoading(false)
      }
      return
    }

    fetch('/api/billing/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error && mountedRef.current) {
          // Keyear la caché por companyId si viene en la respuesta.
          const companyId = data.companyId ?? currentCompanyId ?? 'unknown'
          cachedEntry = { companyId, limits: data }
          setLimits(data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => { mountedRef.current = false }
  }, [currentCompanyId])

  return { limits, loading }
}
