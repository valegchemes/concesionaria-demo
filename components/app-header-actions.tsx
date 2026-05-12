'use client'

import dynamic from 'next/dynamic'

const AppHeaderActionsCore = dynamic(
  () => import('./app-header-actions-core').then((mod) => mod.AppHeaderActionsCore),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center gap-4">
        <div className="h-10 w-full max-w-md rounded-md border border-slate-200 bg-slate-50" />
      </div>
    ),
  }
)

export function AppHeaderActions() {
  return <AppHeaderActionsCore />
}
