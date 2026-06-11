'use client'
import { toast } from 'sonner'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { 
  ArrowLeft, User, Car, Handshake, DollarSign, Calendar, Clock, CreditCard, UserCircle, 
  MessageCircle, Send, X, Lock, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice, generateWhatsAppLink } from '@/lib/utils'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import { generateDealWhatsAppMessage, type DealForMessage, type TaskForMessage } from '@/lib/utils/generate-deal-whatsapp-message'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DealDetail {
  id: string
  status: string
  finalPrice: number
  finalPriceCurrency: string
  depositAmount: number | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  lead: {
    id: string
    name: string
    phone: string
    tasks?: {
      id: string
      title: string
      dueDate: string
      assignedTo?: { name: string } | null
    }[]
  }
  unit: {
    id: string
    title: string
    type: string
  }
  seller: {
    id: string
    name: string
    email: string
    whatsappNumber: string | null
  }
  payments: Array<{ id: string; amount: number; currency: string; method: string; receivedAt: string; notes: string | null }>
  closingCosts: Array<{ id: string; concept: string; amountArs: number | null; amountUsd: number | null }>
  tradeIn: { id: string; description: string; expectedValue: number; offeredValue: number; finalValue: number } | null
}

interface CurrentUser {
  companyName: string
  whatsappCentral?: string | null
}

const statusColors: Record<string, string> = {
  NEGOTIATION: 'bg-blue-100 text-blue-800',
  RESERVED: 'bg-pink-100 text-pink-800',
  APPROVED: 'bg-purple-100 text-purple-800',
  IN_PAYMENT: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  NEGOTIATION: 'Negociación',
  RESERVED: 'Reservado',
  APPROVED: 'Aprobado',
  IN_PAYMENT: 'En Pago',
  DELIVERED: 'Entregado',
  CANCELED: 'Cancelado',
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  
  const getFontSizeClass = (text: string) => {
    const len = text.length
    if (len > 22) return 'text-sm'
    if (len > 18) return 'text-base'
    if (len > 14) return 'text-lg'
    if (len > 10) return 'text-xl'
    return 'text-2xl'
  }
  
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { limits } = usePlanLimits()
  const { user: meData } = useCurrentUser()
  // Construir el objeto 'me' desde el hook compartido
  const me = meData ? { companyName: meData.companyName || '', whatsappCentral: meData.whatsappCentral || null } : null

  // WhatsApp deal modal state
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waPreviewMessage, setWaPreviewMessage] = useState('')
  const [waPhoneNumber, setWaPhoneNumber] = useState<string>('')

  useEffect(() => {
    fetchDeal()
  }, [id])

  async function fetchDeal() {
    try {
      const res = await fetch(`/api/deals/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDeal(data.data)
      } else {
        router.push('/app/deals')
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
      router.push('/app/deals')
    } finally {
      setLoading(false)
    }
  }

  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function updateStatus(newStatus: string) {
    if (!deal) return
    if (newStatus === 'DELIVERED' && !confirm('¿Marcar como Entregado? Esto cerrará la operación y marcará la unidad como Vendida.')) return
    if (newStatus === 'CANCELED' && !confirm('¿Seguro que deseas cancelar esta operación?')) return

    try {
      setUpdatingStatus(true)
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (res.ok) {
        toast.success('Estado actualizado correctamente')
        fetchDeal() // refrescar para obtener los datos actualizados
      } else {
        const err = await res.json()
        toast.error(`Error: ${err.error || 'No se pudo actualizar'}`)
      }
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setUpdatingStatus(false)
    }
  }

  function openWhatsAppModal() {
    if (!deal || !me) return

    const tasks: TaskForMessage[] = (deal.lead.tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo ?? null,
    }))

    const msg = generateDealWhatsAppMessage({
      lead: { name: deal.lead.name, phone: deal.lead.phone },
      deal: deal as any as DealForMessage,
      tasks,
      companyName: me.companyName,
    })
    setWaPreviewMessage(msg)

    // Pre-select phone: central > seller
    const phone = me.whatsappCentral || deal.seller.whatsappNumber || ''
    setWaPhoneNumber(phone)

    setWaModalOpen(true)
  }

  function confirmSendWhatsApp() {
    if (!waPhoneNumber) {
      toast.error('Seleccioná un número de WhatsApp para enviar.')
      return
    }
    const link = generateWhatsAppLink(waPhoneNumber, waPreviewMessage)
    window.open(link, '_blank')
    setWaModalOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!deal) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Operación
              <div onClick={(e) => e.stopPropagation()}>
                <Select
                  disabled={updatingStatus || deal.status === 'CANCELED' || deal.status === 'DELIVERED'}
                  value={deal.status}
                  onValueChange={updateStatus}
                >
                  <SelectTrigger className={`h-8 border-none font-bold uppercase tracking-wider text-xs px-3 rounded-full ${statusColors[deal.status] || 'bg-gray-100 text-gray-800'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs uppercase font-semibold">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Iniciada el {formatDate(deal.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Info) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente (Lead)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">{deal.lead.name}</p>
                    <p className="text-slate-500 text-sm">{deal.lead.phone}</p>
                  </div>
                  <Link href={`/app/leads/${deal.lead.id}`}>
                    <Button variant="outline" size="sm">Ver Ficha</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Unit Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehículo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-lg">{deal.unit.title}</p>
                    <p className="text-slate-500 text-sm capitalize">{deal.unit.type.toLowerCase()}</p>
                  </div>
                  <Link href={`/app/units/${deal.unit.id}`}>
                    <Button variant="outline" size="sm">Ver Unidad</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview */}
          <Card className="border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Precio Final Pactado</p>
                  <p className={`font-black text-slate-900 break-words ${getFontSizeClass(formatPrice(deal.finalPrice, deal.finalPriceCurrency))}`}>
                    {deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}{formatPrice(deal.finalPrice, deal.finalPriceCurrency)}
                  </p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Seña / Anticipo</p>
                  <p className={`font-bold text-blue-600 break-words ${deal.depositAmount ? getFontSizeClass(formatPrice(deal.depositAmount, deal.finalPriceCurrency)) : 'text-2xl'}`}>
                    {deal.depositAmount 
                      ? `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.depositAmount, deal.finalPriceCurrency)}` 
                      : '-'}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 mb-1">Saldo Pendiente</p>
                  <p className={`font-bold text-slate-700 break-words ${getFontSizeClass(formatPrice(deal.finalPrice - (deal.depositAmount || 0), deal.finalPriceCurrency))}`}>
                    {deal.depositAmount 
                      ? `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.finalPrice - deal.depositAmount, deal.finalPriceCurrency)}` 
                      : `${deal.finalPriceCurrency === 'ARS' ? 'ARS ' : ''}${formatPrice(deal.finalPrice, deal.finalPriceCurrency)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-500" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!limits.whatsappEnabled ? (
                <div className="text-center py-4 space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30">
                    <Lock className="h-5 w-5 text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">WhatsApp no disponible en tu plan</p>
                  <p className="text-xs text-gray-500">Activá esta función con el <strong>Plan Pro</strong>.</p>
                  <Link
                    href="/app/settings/billing"
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    Ver planes
                  </Link>
                </div>
              ) : (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 gap-2"
                  onClick={openWhatsAppModal}
                >
                  <Send className="h-4 w-4" />
                  Enviar resumen por WhatsApp
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {deal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-slate-500">Notas de la Operación</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{deal.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Vendedor Asignado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{deal.seller.name}</p>
              <p className="text-sm text-slate-500">{deal.seller.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Línea de Tiempo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                </div>
                <div>
                  <p className="text-sm font-medium">Operación Iniciada</p>
                  <p className="text-xs text-slate-500">{formatDate(deal.createdAt)}</p>
                </div>
              </div>
              {deal.closedAt && (
                <div className="flex gap-3">
                  <div className="mt-1">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Operación Cerrada</p>
                    <p className="text-xs text-slate-500">{formatDate(deal.closedAt)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp deal confirmation modal */}
      {waModalOpen && deal && me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Enviar WhatsApp</h3>
                  <p className="text-xs text-gray-500">Resumen de la operación para el cliente</p>
                </div>
              </div>
              <button onClick={() => setWaModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Enviar desde</p>
                <div className="flex flex-col gap-2">
                  {me.whatsappCentral && (
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${waPhoneNumber === me.whatsappCentral ? 'border-green-500 bg-green-50' : 'hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="phone" 
                        value={me.whatsappCentral} 
                        checked={waPhoneNumber === me.whatsappCentral}
                        onChange={e => setWaPhoneNumber(e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Central</span>
                        <span className="text-xs text-gray-500">{me.whatsappCentral}</span>
                      </div>
                    </label>
                  )}
                  {deal.seller.whatsappNumber && (
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${waPhoneNumber === deal.seller.whatsappNumber ? 'border-green-500 bg-green-50' : 'hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="phone" 
                        value={deal.seller.whatsappNumber} 
                        checked={waPhoneNumber === deal.seller.whatsappNumber}
                        onChange={e => setWaPhoneNumber(e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Asesor ({deal.seller.name})</span>
                        <span className="text-xs text-gray-500">{deal.seller.whatsappNumber}</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Vista previa del mensaje</p>
                <textarea
                  value={waPreviewMessage}
                  onChange={e => setWaPreviewMessage(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                />
                <p className="text-xs text-gray-400">Podés editar el mensaje antes de enviarlo.</p>
              </div>

              {/* T&C Warning */}
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-3 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-orange-800 dark:text-orange-400">Términos y Condiciones de Envío</p>
                  <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-500">
                    Al utilizar la función de envío de WhatsApp, aceptás la responsabilidad total sobre el contenido enviado. El uso indebido, envío masivo de SPAM, o incumplimiento de las políticas de comercio de Meta puede resultar en el <strong>bloqueo temporal o permanente de tu número telefónico</strong>. AutoManager CRM no se hace responsable por los baneos impuestos por WhatsApp.
                  </p>
                </div>
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
    </div>
  )
}
