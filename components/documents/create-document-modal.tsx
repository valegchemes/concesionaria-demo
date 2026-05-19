'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { X, FileSignature, Banknote } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function GlobalCreateDocumentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [docType, setDocType] = useState<'NOTE' | 'DIGITAL'>('DIGITAL')
  const [leads, setLeads] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  
  const [selectedLead, setSelectedLead] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')

  useEffect(() => {
    fetch('/api/leads').then(r => r.json()).then(d => setLeads(d.data || []))
    fetch('/api/units?status=AVAILABLE').then(r => r.json()).then(d => setUnits(d.data || []))
  }, [])

  function handleContinue() {
    if (!selectedLead || !selectedUnit) {
      alert('Por favor seleccioná un cliente y un vehículo')
      return
    }
    
    // Redirect to the unit's page where the user can create documents/notes
    // since the logic is already deeply integrated there.
    router.push(`/app/units/${selectedUnit}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-indigo-500" />
            Crear Nuevo Documento
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para generar un documento, primero vinculá el cliente y la unidad correspondiente.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              type="button"
              variant={docType === 'DIGITAL' ? 'default' : 'outline'}
              className={docType === 'DIGITAL' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
              onClick={() => setDocType('DIGITAL')}
            >
              <FileSignature className="h-4 w-4 mr-2" />
              Boleto / Recibo
            </Button>
            <Button
              type="button"
              variant={docType === 'NOTE' ? 'default' : 'outline'}
              className={docType === 'NOTE' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
              onClick={() => setDocType('NOTE')}
            >
              <Banknote className="h-4 w-4 mr-2" />
              Pagaré / Cuota
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Seleccionar Cliente *</Label>
            <select 
              value={selectedLead} 
              onChange={e => setSelectedLead(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm"
            >
              <option value="">Buscar cliente...</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Seleccionar Unidad *</Label>
            <select 
              value={selectedUnit} 
              onChange={e => setSelectedUnit(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm"
            >
              <option value="">Buscar vehículo...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.title} ({u.domain || 'Sin dominio'})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleContinue} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              Continuar
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
