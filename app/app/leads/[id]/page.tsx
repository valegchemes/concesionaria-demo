'use client'

import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice, generateWhatsAppLink, processTemplate } from '@/lib/utils'
import { 
  ArrowLeft, Phone, Mail, User, Car, MessageCircle, 
  Calendar, CheckCircle, Clock, AlertCircle, Handshake
} from 'lucide-react'

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
    assignedTo: { name: string }
  }[]
  deals: {
    id: string
    status: string
    finalPrice: number
    finalPriceCurrency: string
    depositAmount: number | null
    createdAt: string
    unit: {
      id: string
      title: string
    }
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

  function generateWhatsAppMessage(template: string): string {
    if (!lead) return ''
    return processTemplate(template, {
      leadName: lead.name,
      unitTitle: lead.interestedUnit?.title || '',
      unitPriceARS: lead.interestedUnit?.priceArs?.toString() || '',
      unitPriceUSD: lead.interestedUnit?.priceUsd?.toString() || '',
      publicUnitUrl: `${window.location.origin}/u/${lead.interestedUnit?.id}`,
      companyName: me?.companyName || '',
    })
  }

  function openWhatsApp(fromNumber: string | null | undefined) {
    if (!fromNumber) {
      alert('No hay número de WhatsApp configurado')
      return
    }
    const message = generateWhatsAppMessage(selectedTemplate)
    const link = generateWhatsAppLink(fromNumber, message)
    window.open(link, '_blank')
    addActivity('WHATSAPP_SENT', `Mensaje enviado desde ${fromNumber}`)
  }

  if (loading) return <div>Cargando...</div>
  if (!lead) return <div>Lead no encontrado</div>

  const overdueTasks = lead.tasks?.filter(t => 
    !t.isCompleted && new Date(t.dueDate) < new Date()
  ) || []

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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Plantilla</Label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border text-sm"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.template}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {generateWhatsAppMessage(selectedTemplate)}
              </div>
              <div className="space-y-2">
                <Button 
                  className="w-full bg-green-500 hover:bg-green-600"
                  onClick={() => openWhatsApp(me?.whatsappCentral)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Escribir desde Central
                </Button>
                {lead.assignedTo?.whatsappNumber && (
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => openWhatsApp(lead.assignedTo?.whatsappNumber)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Escribir desde {lead.assignedTo.name}
                  </Button>
                )}
              </div>
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
                          {formatDate(task.dueDate)} • {task.assignedTo.name}
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
    </div>
  )
}
