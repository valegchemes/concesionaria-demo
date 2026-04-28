'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'

const AnalyticsDashboard = dynamic(
  () => import('./analytics-dashboard').then((mod) => mod.AnalyticsDashboard),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent className="py-10 text-center text-gray-400 dark:text-gray-300">
          Cargando analiticas...
        </CardContent>
      </Card>
    ),
  }
)

interface AnalyticsDashboardLazyProps {
  companyId: string
  companyName?: string
  hideHeader?: boolean
}

export function AnalyticsDashboardLazy(props: AnalyticsDashboardLazyProps) {
  return <AnalyticsDashboard {...props} />
}
