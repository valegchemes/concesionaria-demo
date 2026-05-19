'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Banknote, FileSignature, Plus, Lock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotesTab } from '@/components/documents/notes-tab'
import { GlobalDigitalDocumentsTab } from '@/components/documents/digital-documents-tab'
import { GlobalCreateDocumentModal } from '@/components/documents/create-document-modal'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

export default function DocumentsHubPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'notes' | 'digital'>('notes')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { limits, loading } = usePlanLimits()

  // Sync tab with URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'notes' || tab === 'digital') {
        setActiveTab(tab)
      }
    }
  }, [])

  function handleTabChange(tab: 'notes' | 'digital') {
    setActiveTab(tab)
    router.replace(`/app/documents?tab=${tab}`)
  }

  // ── Plan gate ──────────────────────────────────────────────────────────────
  if (!loading && !limits.documentsEnabled) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
            <ShieldAlert className="h-10 w-10 text-amber-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-adaptive-primary">Función no disponible en tu plan</h2>
          <p className="text-adaptive-secondary max-w-md mx-auto">
            La generación de <strong>pagarés, cuotas y boletos de compraventa</strong> es una función exclusiva del{' '}
            <strong className="text-indigo-500">Plan Pro</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-700 dark:text-amber-400 text-left space-y-2 max-w-md mx-auto">
          <p className="font-semibold flex items-center gap-1.5"><Lock className="h-4 w-4" /> Incluido solo en Plan Pro:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Pagarés con cuotas e historial de pagos</li>
            <li>Boletos de compraventa con firma digital</li>
            <li>Recibos de pago</li>
            <li>Contratos y documentos digitales</li>
          </ul>
        </div>
        <Button
          onClick={() => router.push('/app/settings/billing')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 gap-2"
        >
          Ver planes y actualizar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-adaptive-primary tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-500" />
            Documentación
          </h1>
          <p className="text-sm text-adaptive-secondary mt-1">
            Centro de gestión de pagarés, recibos, y boletos de compraventa
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear Documento
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => handleTabChange('notes')}
          className={cn(
            'flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'notes'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <Banknote className="h-4 w-4" />
          Pagarés y Cuotas
        </button>
        <button
          onClick={() => handleTabChange('digital')}
          className={cn(
            'flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'digital'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          <FileSignature className="h-4 w-4" />
          Documentos Digitales
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'digital' && <GlobalDigitalDocumentsTab />}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <GlobalCreateDocumentModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}
