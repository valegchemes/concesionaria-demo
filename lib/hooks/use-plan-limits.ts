'use client'

import { useState, useEffect } from 'react'

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

let cachedLimits: PlanLimits | null = null

export function usePlanLimits() {
  const [limits, setLimits] = useState<PlanLimits>(cachedLimits ?? DEFAULT_LIMITS)
  const [loading, setLoading] = useState(!cachedLimits)

  useEffect(() => {
    if (cachedLimits) {
      setLimits(cachedLimits)
      setLoading(false)
      return
    }

    fetch('/api/billing/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          cachedLimits = data
          setLimits(data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { limits, loading }
}
