'use client'

import { AnalyticsDashboard } from './analytics-dashboard'

interface AnalyticsDashboardLazyProps {
  companyId: string
  companyName?: string
  hideHeader?: boolean
  userRole?: string
}

export function AnalyticsDashboardLazy(props: AnalyticsDashboardLazyProps) {
  return <AnalyticsDashboard {...props} />
}

