'use client'
import { toast } from 'sonner'

import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice, generateWhatsAppLink } from '@/lib/utils'
import { 
  ArrowLeft, Phone, Mail, User, Car, MessageCircle, Send,
  Calendar, CheckCircle, Clock, AlertCircle, Handshake, Lock, X, ChevronDown,
  Sparkles, Copy, Check, Loader2
} from 'lucide-react'
import { LeadPromissoryNotesTab } from '@/components/leads/lead-promissory-notes-tab'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import { generateDealWhatsAppMessage, type DealForMessage, type TaskForMessage } from '@/lib/utils/generate-deal-whatsapp-message'

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: string
  notes: string | null
  lostReason: string | null
  createdAt: string
  assignedTo: { id: string; name: string; whatsappNumber: string | null } | null
  interestedUnit: {
    id: string
    title: string
    priceArs: number | null
    priceUsd: number | null
  } | null
  activities: {
    id: string
    type: string
    notes: string | null
    createdAt: string
    createdBy: { name: string }
  }[]
  tasks: {
    id: string
    title: string
    dueDate: string
    isCompleted: boolean
    assignedTo: { id: string; name: string } | null
  }[]
  deals: {
    id: string
    status: string
    finalPrice: number
    finalPriceCurrency: string
    depositAmount: number | null
    depositDate: string | null
    depositMethod: string | null
    notes: string | null
    createdAt: string
    unit: { id: string; title: string }
    seller: { id: string; name: string; whatsappNumber: string | null } | null
    payments: {
      id: string
      amount: number
      currency: string
      method: string
      receivedAt: string
      notes: string | null
    }[]
  }[]
}

interface WhatsAppTemplate {
  id: string
  name: string
  template: string
}

interface CurrentUser {
  companyName: string
  whatsappCentral?: string | null
}

const sourceLabels: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK_MARKETPLACE: 'Facebook',
  REFERRAL: 'Referido',
  WALK_IN: 'Presencial',
  PHONE: 'Teléfono',
  WEBSITE: 'Web',
  WHATSAPP: 'WhatsApp',
  OLX: 'OLX',
  AUTOSUSADOS: 'AutosUsados',
  OTHER: 'Otro',
}

const statusLabels: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  VISIT_SCHEDULED: 'Visita Agendada',
  OFFER: 'Oferta',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
  LOST: 'Perdido',
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800',
  OFFER: 'bg-orange-100 text-orange-800',
  RESERVED: 'bg-pink-100 text-pink-800',
  SOLD: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-100 text-gray-800',
}

const activityLabels: Record<string, string> = {
  WHATSAPP_SENT: 'WhatsApp enviado',
  CALL_MADE: 'Llamada realizada',
  CALL_RECEIVED: 'Llamada recibida',
  VISIT_DONE: 'Visita realizada',
  OFFER_RECEIVED: 'Oferta recibida',
  EMAIL_SENT: 'Email enviado',
  NOTE_ADDED: 'Nota agregada',
  STATUS_CHANGED: 'Cambio de estado',
  TASK_COMPLETED: 'Tarea completada',
}

const DEAL_STATUS_LABELS: Record<string, string> = {
  NEGOTIATION: 'En negociación',
  RESERVED: 'Reservado',
  APPROVED: 'Aprobado',
  IN_PAYMENT: 'En proceso de pago',
  DELIVERED: 'Entregado',
  CANCELED: 'Cancelado',
}


export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap promise for Next.js 15
  const { id } = use(params)
  
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newActivityNote, setNewActivityNote] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info')
  const { limits } = usePlanLimits()

  // WhatsApp deal modal state
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string>('')
  const [waPreviewMessage, setWaPreviewMessage] = useState('')
  const [waPhoneNumber, setWaPhoneNumber] = useState<string>('')

  // AI assistant state
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiSelectedUnitId, setAiSelectedUnitId] = useState<string>('')
  const [aiPrice, setAiPrice] = useState<number>(0)
  const [aiDownPayment, setAiDownPayment] = useState<number>(0)
  const [aiInterestRate, setAiInterestRate] = useState<number>(48)
  const [aiFinancingType, setAiFinancingType] = useState<'fixed' | 'uva' | 'usd'>('fixed')
  const [aiMonthsOptions, setAiMonthsOptions] = useState<number[]>([12, 24, 36, 48])
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [units, setUnits] = useState<{ id: string; title: string; priceArs: number | null; priceUsd: number | null }[]>([])
  const [copied, setCopied] = useState(false)

  const openAiAssistant = useCallback(async () => {
    setIsAiOpen(true)
    setAiError(null)
    setAiResponse('')
    setAiQuestion('')
    
    // Pre-select lead's interested unit if it exists
    if (lead?.interestedUnit) {
      setAiSelectedUnitId(lead.interestedUnit.id)
      const uPrice = lead.interestedUnit.priceUsd || lead.interestedUnit.priceArs || 0
      setAiPrice(uPrice)
      setAiDownPayment(Math.round(uPrice * 0.4))
      if (lead.interestedUnit.priceUsd) {
        setAiFinancingType('usd')
      } else {
        setAiFinancingType('fixed')
      }
    } else {
      setAiSelectedUnitId('')
      setAiPrice(0)
      setAiDownPayment(0)
      setAiFinancingType('fixed')
    }

    // Fetch available units
    try {
      const res = await fetch('/api/units?limit=100')
      if (res.ok) {
        const data = await res.json()
        setUnits(data.units || [])
        // If no unit was preselected but we have units, select the first one
        if (!lead?.interestedUnit && data.units?.[0]) {
          const firstUnit = data.units[0]
          setAiSelectedUnitId(firstUnit.id)
          const uPrice = firstUnit.priceUsd || firstUnit.priceArs || 0
          setAiPrice(uPrice)
          setAiDownPayment(Math.round(uPrice * 0.4))
          if (firstUnit.priceUsd) {
            setAiFinancingType('usd')
          }
        }
      }
    } catch (err) {
      console.error('Error fetching units for AI:', err)
    }
  }, [lead])

  const handleAiUnitChange = (unitId: string) => {
    setAiSelectedUnitId(unitId)
    const unit = units.find(u => u.id === unitId)
    if (unit) {
      const uPrice = unit.priceUsd || unit.priceArs || 0
      setAiPrice(uPrice)
      setAiDownPayment(Math.round(uPrice * 0.4))
      if (unit.priceUsd) {
        setAiFinancingType('usd')
      } else {
        setAiFinancingType('fixed')
      }
    }
  }

  const generateAiResponse = async () => {
    setAiLoading(true)
    setAiError(null)
    setAiResponse('')

    try {
      const res = await fetch(`/api/leads/${id}/ai-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedUnitId: aiSelectedUnitId || null,
          clientQuestion: aiQuestion,
          price: aiPrice,
          downPayment: aiDownPayment,
          interestRate: aiInterestRate,
          financingType: aiFinancingType,
          monthsOptions: aiMonthsOptions,
        })
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Error al generar la respuesta de la IA.')
      }

      setAiResponse(result.data)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al procesar la respuesta')
    } finally {
      setAiLoading(false)
    }
  }

  const handleCopyAiResponse = () => {
    navigator.clipboard.writeText(aiResponse)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendAiWhatsApp = () => {
    const link = generateWhatsAppLink(lead?.phone || '', aiResponse)
    window.open(link, '_blank')
    addActivity('WHATSAPP_SENT', 'Respuesta comercial con IA enviada por WhatsApp.')
    setIsAiOpen(false)
  }

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (res.ok) {
        const data = await res.json()
        setLead(data.data)
      }
    } catch (error) {
      console.error('Error fetching lead:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
        if (data[0]) setSelectedTemplate(data[0].template)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }, [])

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setMe({
          companyName: data.companyName || '',
          whatsappCentral: data.whatsappCentral || null,
        })
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLead()
    void fetchTemplates()
    void fetchCurrentUser()
  }, [fetchCurrentUser, fetchLead, fetchTemplates])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskTitle || !newTaskDate) return

    try {
      const res = await fetch(`/api/leads/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          dueDate: new Date(newTaskDate).toISOString(),
        }),
      })

      if (res.ok) {
        setNewTaskTitle('')
        setNewTaskDate('')
        fetchLead()
      }
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  async function completeTask(taskId: string) {
    try {
      const res = await fetch(`/api/leads/${id}/tasks?taskId=${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      })

      if (res.ok) {
        fetchLead()
      }
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  async function addActivity(type: string, notes?: string) {
    try {
      const res = await fetch(`/api/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, notes }),
      })

      if (res.ok) {
        setNewActivityNote('')
        fetchLead()
      }
    } catch (error) {
      console.error('Error adding activity:', error)
    }
  }

  function openDealWhatsAppModal() {
    if (!lead || !me) return
    // Pre-select first non-canceled deal
    const defaultDeal = lead.deals.find(d => d.status !== 'CANCELED') ?? lead.deals[0]
    if (!defaultDeal) {
      toast.error('No hay operaciones registradas para este lead.')
      return
    }
    const dealId = defaultDeal.id
    setSelectedDealId(dealId)

    const tasks: TaskForMessage[] = lead.tasks.map(t => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
    }))

    const msg = generateDealWhatsAppMessage({
      lead: { name: lead.name, phone: lead.phone },
      deal: defaultDeal as DealForMessage,
      tasks,
      companyName: me.companyName,
    })
    setWaPreviewMessage(msg)

    // Pre-select phone: central > seller > assigned
    const phone = me.whatsappCentral || defaultDeal.seller?.whatsappNumber || lead.assignedTo?.whatsappNumber || ''
    setWaPhoneNumber(phone)

    setWaModalOpen(true)
  }

  function onDealChange(dealId: string) {
    if (!lead || !me) return
    setSelectedDealId(dealId)
    const deal = lead.deals.find(d => d.id === dealId)
    if (!deal) return

    const tasks: TaskForMessage[] = lead.tasks.map(t => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
    }))

    const msg = generateDealWhatsAppMessage({
      lead: { name: lead.name, phone: lead.phone },
      deal: deal as DealForMessage,
      tasks,
      companyName: me.companyName,
    })
    setWaPreviewMessage(msg)
  }

  function confirmSendWhatsApp() {
    if (!waPhoneNumber) {
      toast.error('Seleccioná un número de WhatsApp para enviar.')
      return
    }
    const link = generateWhatsAppLink(waPhoneNumber, waPreviewMessage)
    window.open(link, '_blank')
    addActivity('WHATSAPP_SENT', `Mensaje enviado a ${waPhoneNumber}`)
    setWaModalOpen(false)
  }

  if (loading) return <div>Cargando...</div>
  if (!lead) return <div>Lead no encontrado</div>

  const overdueTasks = lead.tasks?.filter(t =>
    !t.isCompleted && new Date(t.dueDate) < new Date()
  ) || []

  // Build phone options for modal
  const waPhoneOptions: { label: string; value: string }[] = []
  if (me?.whatsappCentral) waPhoneOptions.push({ label: `Central (${me.whatsappCentral})`, value: me.whatsappCentral })
  lead.deals.forEach(d => {
    if (d.seller?.whatsappNumber && !waPhoneOptions.find(p => p.value === d.seller!.whatsappNumber)) {
      waPhoneOptions.push({ label: `${d.seller.name} (${d.seller.whatsappNumber})`, value: d.seller.whatsappNumber })
    }
  })
  if (lead.assignedTo?.whatsappNumber && !waPhoneOptions.find(p => p.value === lead.assignedTo!.whatsappNumber)) {
    waPhoneOptions.push({ label: `${lead.assignedTo.name} (${lead.assignedTo.whatsappNumber})`, value: lead.assignedTo.whatsappNumber })
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{lead.name}</h1>
        <span className={`px-3 py-1 rounded-full text-sm ${statusColors[lead.status]}`}>
          {statusLabels[lead.status]}
        </span>
        {overdueTasks.length > 0 && (
          <span className="flex items-center gap-1 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            {overdueTasks.length} tarea(s) vencida(s)
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['info', 'Información y Actividad'], ['notes', 'Pagarés y Cuotas']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'notes' && (
        <LeadPromissoryNotesTab
          leadId={lead.id}
          unitId={lead.interestedUnit?.id}
          unitTitle={lead.interestedUnit?.title}
        />
      )}

      {activeTab === 'info' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Contact Info & WhatsApp */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span>{lead.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span>Origen: {sourceLabels[lead.source]}</span>
              </div>
              {lead.assignedTo && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>Asignado: {lead.assignedTo.name}</span>
                </div>
              )}
              {lead.interestedUnit && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-gray-500" />
                  <span>Interesado en: </span>
                  <Link href={`/app/units/${lead.interestedUnit.id}`} className="text-blue-600 hover:underline">
                    {lead.interestedUnit.title}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {limits.whatsappEnabled && lead.deals.length > 0 && (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 gap-2 text-white"
                  onClick={openDealWhatsAppModal}
                >
                  <Send className="h-4 w-4" />
                  Enviar resumen por WhatsApp
                </Button>
              )}
              
              {limits.aiEnabled ? (
                <Button
                  type="button"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2 text-white font-bold transition-transform hover:scale-[1.02]"
                  onClick={openAiAssistant}
                >
                  <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                  Asistente de Respuesta con IA
                </Button>
              ) : (
                <Link href="/app/settings/billing" className="w-full block">
                  <Button
                    type="button"
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 gap-2 font-bold border border-slate-200 dark:border-slate-700/60"
                  >
                    <Lock className="h-4 w-4 text-slate-400" />
                    Asistente con IA (Plan Pro)
                  </Button>
                </Link>
              )}

              {!limits.whatsappEnabled && (
                <div className="text-center py-2 space-y-1.5 border-t border-dashed border-slate-200 dark:border-slate-800 pt-3 mt-1">
                  <p className="text-[11px] text-gray-500">
                    Sincronización automática de WhatsApp no disponible en tu plan.
                  </p>
                  <Link
                    href="/app/settings/billing"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    Ver Planes Pro 🚀
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => addActivity('CALL_MADE', 'Llamada realizada')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Registrar Llamada
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => addActivity('VISIT_DONE', 'Visita realizada')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Registrar Visita
              </Button>
            </CardContent>
          </Card>

          {lead.deals && lead.deals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Handshake className="h-5 w-5 text-purple-500" />
                  Operaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.deals.map((deal) => (
                  <div key={deal.id} className="p-3 border rounded-lg bg-slate-50 space-y-2">
                    <div className="flex justify-between items-start">
                      <Link href={`/app/units/${deal.unit.id}`} className="font-medium text-blue-600 hover:underline">
                        {deal.unit.title}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[deal.status] || 'bg-slate-100 text-slate-800'}`}>
                        {statusLabels[deal.status] || deal.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div>
                        <p className="text-slate-500 text-xs">Precio Final</p>
                        <p className="font-semibold">{deal.finalPriceCurrency} {formatPrice(deal.finalPrice)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Seña / Anticipo</p>
                        <p className="font-semibold">{deal.depositAmount ? `${deal.finalPriceCurrency} ${formatPrice(deal.depositAmount)}` : '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle column - Tasks */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tareas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addTask} className="space-y-2">
                <Input
                  placeholder="Nueva tarea..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                  />
                  <Button type="submit" size="sm">Agregar</Button>
                </div>
              </form>

              <div className="space-y-2">
                {lead.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      task.isCompleted 
                        ? 'bg-gray-50' 
                        : new Date(task.dueDate) < new Date()
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!task.isCompleted && (
                        <button
                          onClick={() => completeTask(task.id)}
                          className="mt-1"
                        >
                          <CheckCircle className="h-4 w-4 text-gray-400 hover:text-green-500" />
                        </button>
                      )}
                      <div>
                        <p className={task.isCompleted ? 'line-through text-gray-500' : 'font-medium'}>
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(task.dueDate)} • {task.assignedTo?.name ?? '—'}
                        </p>
                      </div>
                    </div>
                    {task.isCompleted && (
                      <span className="text-xs text-green-600">Completada</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Activities */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Actividades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <textarea
                  placeholder="Agregar nota..."
                  value={newActivityNote}
                  onChange={(e) => setNewActivityNote(e.target.value)}
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border text-sm"
                />
                <Button 
                  size="sm"
                  onClick={() => addActivity('NOTE_ADDED', newActivityNote)}
                  disabled={!newActivityNote}
                >
                  Agregar Nota
                </Button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {lead.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {activityLabels[activity.type]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(activity.createdAt)}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-sm text-gray-600 mt-1">{activity.notes}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        por {activity.createdBy.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* WhatsApp deal confirmation modal */}
      {waModalOpen && lead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Enviar WhatsApp</h3>
                  <p className="text-xs text-gray-500">Revisá el mensaje antes de enviarlo</p>
                </div>
              </div>
              <button onClick={() => setWaModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Operación</Label>
                <div className="relative">
                  <select
                    value={selectedDealId}
                    onChange={e => onDealChange(e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-lg border bg-white dark:bg-slate-800 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {lead.deals.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.unit.title} — {DEAL_STATUS_LABELS[d.status] ?? d.status} ({d.finalPriceCurrency} {Number(d.finalPrice).toLocaleString('es-AR')})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Enviar desde</Label>
                {waPhoneOptions.length > 0 ? (
                  <div className="relative">
                    <select
                      value={waPhoneNumber}
                      onChange={e => setWaPhoneNumber(e.target.value)}
                      className="w-full h-10 pl-3 pr-8 rounded-lg border bg-white dark:bg-slate-800 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {waPhoneOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                ) : (
                  <Input
                    value={waPhoneNumber}
                    onChange={e => setWaPhoneNumber(e.target.value)}
                    placeholder="Número de WhatsApp (ej: 5491112345678)"
                    className="text-sm"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Vista previa del mensaje</Label>
                <textarea
                  value={waPreviewMessage}
                  onChange={e => setWaPreviewMessage(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                />
                <p className="text-xs text-gray-400">Podés editar el mensaje antes de enviarlo.</p>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t dark:border-slate-800">
              <Button variant="outline" className="flex-1" onClick={() => setWaModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2 text-white"
                onClick={confirmSendWhatsApp}
              >
                <Send className="h-4 w-4" />
                Confirmar y abrir WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {isAiOpen && lead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/40">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Asistente de Respuesta Comercial con IA</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Generá propuestas de financiación y respuestas personalizadas al instante</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAiOpen(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
              
              {/* Left Column: Form & Settings */}
              <div className="space-y-4">
                
                {/* Step 1: Select vehicle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">1. Vehículo de Interés</Label>
                  <div className="relative">
                    <select
                      value={aiSelectedUnitId}
                      onChange={e => handleAiUnitChange(e.target.value)}
                      className="w-full h-10 pl-3 pr-8 rounded-lg border bg-white dark:bg-slate-800 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
                    >
                      <option value="">Seleccionar vehículo...</option>
                      {units.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.title} — {u.priceUsd ? `USD ${u.priceUsd.toLocaleString('es-AR')}` : u.priceArs ? `$ ${u.priceArs.toLocaleString('es-AR')} ARS` : 'Consultar'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* Step 2: Financiación Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Precio de Venta</Label>
                    <Input
                      type="number"
                      value={aiPrice}
                      onChange={e => setAiPrice(Number(e.target.value))}
                      className="text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Anticipo / Entrega</Label>
                    <Input
                      type="number"
                      value={aiDownPayment}
                      onChange={e => setAiDownPayment(Number(e.target.value))}
                      className="text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tasa de Interés Anual (TNA %)</Label>
                    <Input
                      type="number"
                      value={aiInterestRate}
                      onChange={e => setAiInterestRate(Number(e.target.value))}
                      className="text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tipo de Moneda</Label>
                    <div className="relative">
                      <select
                        value={aiFinancingType}
                        onChange={e => setAiFinancingType(e.target.value as any)}
                        className="w-full h-10 pl-3 pr-8 rounded-lg border bg-white dark:bg-slate-800 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
                      >
                        <option value="fixed">Pesos Fija ($)</option>
                        <option value="uva">Pesos UVA (Ajustable)</option>
                        <option value="usd">Dólares (USD)</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Step 3: Question or Instruction */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">2. Consulta del Cliente / Instrucciones</Label>
                  <textarea
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    placeholder="Pegá el mensaje de WhatsApp del cliente o indicá qué querés responder (ej: 'El cliente quiere saber si tomamos permutas y cómo le quedan 24 y 36 cuotas')"
                    rows={4}
                    className="w-full rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <Button
                  type="button"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2 text-white font-bold h-11"
                  onClick={generateAiResponse}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Redactando propuesta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      Generar Respuesta con IA ✨
                    </>
                  )}
                </Button>

                {aiError && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">{aiError}</p>
                )}
              </div>

              {/* Right Column: AI Output & Actions */}
              <div className="flex flex-col h-full space-y-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">3. Propuesta Sugerida</Label>
                
                <div className="flex-1 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 overflow-y-auto max-h-[300px] lg:max-h-[350px]">
                  {aiResponse ? (
                    <div className="text-sm whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 leading-relaxed">
                      {aiResponse}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2 py-8">
                      <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-pulse" />
                      <p className="text-xs font-medium">Acá aparecerá el borrador generado por la IA.</p>
                      <p className="text-[10px] text-gray-400 max-w-[250px]">Completá los campos de la izquierda y presioná "Generar Respuesta con IA".</p>
                    </div>
                  )}
                </div>

                {aiResponse && (
                  <div className="flex gap-3">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="flex-1 gap-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      onClick={handleCopyAiResponse}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar Texto
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-green-500 hover:bg-green-600 gap-2 text-white font-bold"
                      onClick={handleSendAiWhatsApp}
                    >
                      <Send className="h-4 w-4" />
                      Enviar WhatsApp
                    </Button>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t dark:border-slate-800 flex justify-end">
              <Button 
                type="button"
                variant="ghost" 
                onClick={() => setIsAiOpen(false)}
                className="text-slate-600 dark:text-slate-400"
              >
                Cerrar
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
