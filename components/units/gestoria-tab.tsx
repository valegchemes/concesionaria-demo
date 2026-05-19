'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { 
  FileText, ShieldCheck, CheckCircle2, AlertCircle, Clock, 
  HelpCircle, ClipboardList, PenTool, Save, RotateCcw, AlertTriangle
} from 'lucide-react'

interface Attribute {
  id?: string
  key: string
  value: string
}

interface GestoriaTabProps {
  unitId: string
  attributes: Attribute[]
  onSaveAttributes: (updatedAttrs: { key: string; value: string }[]) => Promise<boolean>
}

// 7 Key documents required for car transfer in Argentina
const GESTORIA_ITEMS = [
  { key: 'gestor_cedula', label: 'Cédula Verde / Cédula Azul', description: 'Cédula física o digital legible para circular' },
  { key: 'gestor_08', label: 'Formulario 08 Firmado', description: 'Firmas certificadas ante escribano o Registro Seccional' },
  { key: 'gestor_f12', label: 'Verificación Policial (Formulario 12)', description: 'Constancia física de motor y chasis homologada y vigente' },
  { key: 'gestor_dominio', label: 'Informe de Dominio', description: 'Verificación de gravámenes, inhibiciones o embargos activos' },
  { key: 'gestor_multas', label: 'Libre Deuda de Infracciones (F.13I)', description: 'Consulta unificada de multas provinciales y municipales' },
  { key: 'gestor_patentes', label: 'Libre Deuda de Patentes', description: 'Estado de cuenta e impuesto de patentes regularizado' },
  { key: 'gestor_ceta', label: 'Formulario CETA (AFIP)', description: 'Certificado de Transferencia de Automotores de AFIP' },
]

type StatusType = 'PENDIENTE' | 'TRAMITE' | 'COMPLETO' | 'NO_APLICA'

const STATUS_CONFIG: Record<StatusType, { label: string; bg: string; text: string; icon: any }> = {
  PENDIENTE: { label: 'Pendiente', bg: 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100/70 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
  TRAMITE: { label: 'En Trámite', bg: 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  COMPLETO: { label: 'Completo', bg: 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', icon: ShieldCheck },
  NO_APLICA: { label: 'No Aplica', bg: 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400', text: 'text-slate-500 dark:text-slate-400', icon: HelpCircle },
}

export function GestoriaTab({ unitId, attributes, onSaveAttributes }: GestoriaTabProps) {
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({})
  const [notes, setNotes] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Initialize values from active attributes
  useEffect(() => {
    const loadedStatuses: Record<string, StatusType> = {}
    
    GESTORIA_ITEMS.forEach(item => {
      const match = attributes.find(a => a.key === item.key)
      let val: StatusType = 'PENDIENTE'
      if (match?.value === 'PENDIENTE' || match?.value === 'TRAMITE' || match?.value === 'COMPLETO' || match?.value === 'NO_APLICA') {
        val = match.value as StatusType
      }
      loadedStatuses[item.key] = val
    })

    const notesMatch = attributes.find(a => a.key === 'gestor_notes')
    
    setStatuses(loadedStatuses)
    setNotes(notesMatch?.value || '')
  }, [attributes])

  const handleStatusChange = (key: string, newStatus: StatusType) => {
    setStatuses(prev => ({ ...prev, [key]: newStatus }))
    setSaveSuccess(false)
  }

  // Save changes to database through attributes utility
  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      // 1. Build the updated checklist values
      const updatedList: { key: string; value: string }[] = Object.entries(statuses).map(([key, value]) => ({
        key,
        value
      }))

      // 2. Add Gestor notes
      updatedList.push({
        key: 'gestor_notes',
        value: notes
      })

      // 3. Keep all other non-gestor attributes intact so we don't wipe them!
      const nonGestorAttrs = attributes
        .filter(a => !GESTORIA_ITEMS.some(item => item.key === a.key) && a.key !== 'gestor_notes')
        .map(a => ({ key: a.key, value: a.value }))

      const finalPayload = [...nonGestorAttrs, ...updatedList]
      
      const success = await onSaveAttributes(finalPayload)
      if (success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } catch (err) {
      console.error('Error saving gestoria:', err)
      alert('Error al guardar los estados de gestoría.')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate Progress Percentages
  const totalRelevant = GESTORIA_ITEMS.filter(item => statuses[item.key] !== 'NO_APLICA').length
  const totalCompleted = GESTORIA_ITEMS.filter(item => statuses[item.key] === 'COMPLETO').length
  const progressPercent = totalRelevant > 0 ? Math.round((totalCompleted / totalRelevant) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Visual Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 border border-border">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 flex-1">
              <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">Control de Trámites</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Progreso Legal de la Unidad</h3>
              <p className="text-xs text-muted-foreground">Monitoreo de documentación obligatoria para la transferencia segura del vehículo.</p>
            </div>
            
            {/* Real Progress Bar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" className="stroke-muted fill-transparent" strokeWidth="6" />
                  <circle 
                    cx="32" 
                    cy="32" 
                    r="28" 
                    className="stroke-primary fill-transparent transition-all duration-500 ease-out" 
                    strokeWidth="6" 
                    strokeDasharray={2 * Math.PI * 28} 
                    strokeDashoffset={2 * Math.PI * 28 * (1 - progressPercent / 100)} 
                  />
                </svg>
                <span className="absolute text-sm font-black text-slate-800 dark:text-slate-100">{progressPercent}%</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completado</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Controls Box */}
        <Card className="flex flex-col justify-center border border-border">
          <CardContent className="p-6 space-y-3 flex flex-col justify-center h-full">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isSaving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Guardando...' : 'Guardar Trámite'}
            </Button>
            {saveSuccess && (
              <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> ¡Trámite guardado correctamente!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Checklist items */}
      <Card className="border border-border">
        <CardHeader className="bg-muted/40 pb-4 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            Checklist de Documentación Legal (Argentina)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {GESTORIA_ITEMS.map((item) => {
            const currentStatus = statuses[item.key] || 'PENDIENTE'
            const config = STATUS_CONFIG[currentStatus]
            const StatusIcon = config.icon

            return (
              <div key={item.key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                {/* Text explanation */}
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</h4>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>

                {/* Status Switcher Selector chips */}
                <div className="flex flex-wrap gap-1.5 self-start md:self-center">
                  {(['PENDIENTE', 'TRAMITE', 'COMPLETO', 'NO_APLICA'] as StatusType[]).map((status) => {
                    const isSelected = currentStatus === status
                    const conf = STATUS_CONFIG[status]
                    
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(item.key, status)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isSelected 
                            ? conf.bg + ' shadow-sm scale-[1.03]'
                            : 'bg-background hover:bg-slate-50 dark:hover:bg-slate-800 border-border text-muted-foreground dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                      >
                        {isSelected && <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                        {conf.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Gestor timeline comments box */}
      <Card className="border border-border">
        <CardHeader className="bg-muted/40 pb-4 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <PenTool className="h-5 w-5 text-indigo-600" />
            Observaciones e Historial del Gestor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaveSuccess(false); }}
            placeholder="Escribí aquí novedades sobre el estado legal del auto, por ejemplo:
- 19/05/2026: Se ingresó la transferencia en el Registro Seccional N° 3.
- Firma certificada del comprador pendiente..."
            className="w-full min-h-[140px] px-4 py-3 rounded-2xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </CardContent>
      </Card>
    </div>
  )
}
