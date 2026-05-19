'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Banknote, FileSignature, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotesTab } from '@/components/documents/notes-tab'
import { GlobalDigitalDocumentsTab } from '@/components/documents/digital-documents-tab'
import { GlobalCreateDocumentModal } from '@/components/documents/create-document-modal'

export default function DocumentsHubPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'notes' | 'digital'>('notes')
  const [showCreateModal, setShowCreateModal] = useState(false)

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
