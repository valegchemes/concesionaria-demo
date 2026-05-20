'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import { 
  Mail, Sparkles, Send, Loader2, Lock, ArrowLeft,
  CheckCircle, AlertCircle, Inbox, MailCheck, Reply, ChevronDown
} from 'lucide-react'

interface EmailLog {
  id: string
  clientEmail: string
  subject: string
  message: string
  replySubject: string
  replyBody: string
  createdAt: string
}

export default function EmailAiResponderPage() {
  const { limits, loading: limitsLoading } = usePlanLimits()

  // State fields
  const [companyEmail, setCompanyEmail] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // Simulator state
  const [simSender, setSimSender] = useState('comprador.interesado@gmail.com')
  const [simSubject, setSimSubject] = useState('Consulta por vehículo en stock y financiación')
  const [simMessage, setSimMessage] = useState(
    'Hola! Vi que tienen un Fiat Cronos publicado. Me gustaría saber qué kilometraje real tiene, qué precio final me queda y qué facilidades de financiación tienen para pagarlo en cuotas. Gracias!'
  )
  const [simLoading, setSimLoading] = useState(false)
  const [simStatusMsg, setSimStatusMsg] = useState('')
  const [simError, setSimError] = useState<string | null>(null)
  const [simSuccess, setSimSuccess] = useState(false)

  // Fetch company settings and email logs
  const fetchData = useCallback(async () => {
    try {
      const [compRes, logsRes] = await Promise.all([
        fetch('/api/settings/company', { cache: 'no-store' }),
        fetch('/api/email/inbound', { cache: 'no-store' })
      ])

      if (compRes.ok) {
        const compData = await compRes.json()
        setCompanyEmail(compData.email || '')
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json()
        if (logsData.logs) {
          setLogs(logsData.logs)
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!limitsLoading && limits.aiEnabled) {
      fetchData()
    }
  }, [limitsLoading, limits.aiEnabled, fetchData])

  // Simulate receiving email and auto-reply
  const handleSimulateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSimLoading(true)
    setSimError(null)
    setSimSuccess(false)
    
    // Step-by-step progress status messages for realistic premium AI experience
    const statuses = [
      'Recibiendo correo entrante en servidor...',
      'Analizando texto e intencionalidad del cliente con IA...',
      'Consultando disponibilidad real de vehículos en tu catálogo...',
      'Calculando opciones y planes de financiación aplicables...',
      'Redactando respuesta comercial personalizada con Gemini...'
    ]

    let currentStep = 0
    setSimStatusMsg(statuses[0])
    
    const interval = setInterval(() => {
      if (currentStep < statuses.length - 1) {
        currentStep++
        setSimStatusMsg(statuses[currentStep])
      }
    }, 1100)

    try {
      const res = await fetch('/api/email/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: simSender,
          subject: simSubject,
          message: simMessage
        })
      })

      clearInterval(interval)

      if (res.ok) {
        const data = await res.json()
        setSimSuccess(true)
        // Prepend new log
        if (data.log) {
          setLogs(prev => [data.log, ...prev])
        }
        // Reset message but keep sender for next tests
        setSimMessage('')
        setSimSubject('Consulta de información')
      } else {
        const errData = await res.json().catch(() => null)
        setSimError(errData?.error || 'No se pudo simular la auto-respuesta.')
      }
    } catch (err) {
      clearInterval(interval)
      setSimError('Error de red. Verifique la conexión.')
    } finally {
      setSimLoading(false)
      setSimStatusMsg('')
    }
  }

  // Loader / Lock Screens
  if (limitsLoading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Validando nivel de acceso...</p>
      </div>
    )
  }

  if (!limits.aiEnabled) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="text-center py-10 space-y-6 flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8">
          <div className="h-16 w-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200 text-amber-500 ring-4 ring-amber-50 dark:bg-indigo-950/20 dark:border-indigo-800/40 dark:text-indigo-400">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h4 className="text-lg font-bold text-slate-800 dark:text-white">Auto-responder de Email con IA</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              El auto-responder automático por correo electrónico con Inteligencia Artificial está disponible únicamente para suscriptores del **Plan Pro**.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Ahorrá horas de trabajo respondiendo consultas de clientes de forma prolija, con fichas técnicas, precios de stock y cotizaciones de cuotas las 24 horas del día.
            </p>
          </div>
          <Link href="/app/settings/billing" className="w-full pt-2">
            <Button type="button" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-sm">
              Actualizar al Plan Pro 🚀
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/app/settings" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-adaptive-primary flex items-center gap-2">
              Email Comercial con IA 🤖
              <span className="bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-800/40">
                Premium
              </span>
            </h1>
          </div>
          <p className="text-adaptive-secondary text-sm">
            Configuración y simulación del auto-responder inteligente de correos para tu concesionaria.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Settings and Simulator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Email Settings Card */}
          <Card className="surface-secondary border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b dark:border-slate-800/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-indigo-500" />
                  <CardTitle className="text-base font-bold">Email Adherido de la Concesionaria</CardTitle>
                </div>
                
                {/* Active Switch Toggle visual indicator */}
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                  <button 
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isActive ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="commEmail">Dirección de Email Activa</Label>
                <Input
                  id="commEmail"
                  value={companyEmail || 'No configurado'}
                  disabled
                  className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-medium"
                />
                <p className="text-[11px] text-slate-400">
                  Para modificar este email, dirígete a la <Link href="/app/settings" className="text-indigo-600 hover:underline">Configuración General</Link> de la concesionaria.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl border p-4 text-xs space-y-2 border-slate-200 dark:border-slate-800/60">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  ¿Cómo funciona el Auto-responder inteligente?
                </p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Cuando la casilla comercial recibe un correo electrónico de consulta de un cliente potencial, la IA de Gemini analiza el mensaje de forma instantánea.
                  Posteriormente, genera un correo electrónico de respuesta detallada incluyendo precios actuales de catálogo, especificaciones de kilometraje, enlaces dinámicos a la ficha técnica web del vehículo y a la propuesta de financiación interactiva en PDF.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Simulator Card */}
          <Card className="surface-secondary border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="border-b dark:border-slate-800/60">
              <div className="flex items-center gap-2">
                <Reply className="h-5 w-5 text-indigo-500" />
                <div>
                  <CardTitle className="text-base font-bold">Simulador de Correo Electrónico Entrante</CardTitle>
                  <CardDescription>Probá cómo responde la IA ante diferentes solicitudes simulando la llegada de un email.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSimulateEmail} className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="simSender">Email del Cliente (De:)</Label>
                    <Input
                      id="simSender"
                      value={simSender}
                      onChange={e => setSimSender(e.target.value)}
                      required
                      placeholder="ej: cliente@gmail.com"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="simSubject">Asunto</Label>
                    <Input
                      id="simSubject"
                      value={simSubject}
                      onChange={e => setSimSubject(e.target.value)}
                      required
                      placeholder="Consulta por..."
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="simMessage">Mensaje del Cliente</Label>
                  <textarea
                    id="simMessage"
                    value={simMessage}
                    onChange={e => setSimMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="Escribí el correo de consulta del cliente (ej. consultas de stock, permutas, financiación de un modelo específico)..."
                    className="w-full rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={simLoading || !isActive}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 transition-all gap-2"
                >
                  {simLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>{simStatusMsg}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                      Simular Correo y Auto-responder con IA ✨
                    </>
                  )}
                </Button>

                {simError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 text-xs font-semibold rounded-lg border border-red-200/50 dark:border-red-900/40 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{simError}</span>
                  </div>
                )}

                {simSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 text-xs font-semibold rounded-lg border border-green-200/50 dark:border-green-900/40 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span>¡Correo procesado! La respuesta de la IA ha sido redactada y agregada al historial.</span>
                  </div>
                )}

              </form>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Historical Logs */}
        <div className="col-span-1 space-y-6">
          <Card className="surface-secondary border-slate-200 dark:border-slate-800 shadow-sm flex flex-col max-h-[660px] overflow-hidden">
            <CardHeader className="border-b dark:border-slate-800/60 pb-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-indigo-500" />
                <div>
                  <CardTitle className="text-base font-bold">Bandeja de Respuestas de IA</CardTitle>
                  <CardDescription>Historial de correos interceptados y auto-respondidos.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 divide-y dark:divide-slate-800/50">
              
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-xs">Cargando bandeja de entrada...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-3 px-6">
                  <MailCheck className="h-10 w-10 text-slate-300 dark:text-slate-700 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Bandeja Vacía</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">
                      Completá el formulario simulador de la izquierda para registrar tu primera interacción de IA.
                    </p>
                  </div>
                </div>
              ) : (
                logs.map((logItem) => (
                  <div key={logItem.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors">
                    
                    {/* Log Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {logItem.clientEmail}
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                          Asunto: {logItem.subject}
                        </p>
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium shrink-0 mt-0.5">
                        {new Date(logItem.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Original Message Preview */}
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200/50 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      <strong>Mensaje Cliente:</strong> {logItem.message}
                    </div>

                    {/* AI Reply Preview Drawer */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-3 border border-indigo-100/50 dark:border-indigo-900/30 text-[11px] text-indigo-950 dark:text-indigo-200 leading-relaxed font-sans relative overflow-hidden">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mb-1.5 uppercase tracking-wide">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        Respuesta Automática de IA
                      </div>
                      <div className="whitespace-pre-wrap max-h-[150px] overflow-y-auto pr-1">
                        {logItem.replyBody}
                      </div>
                    </div>

                  </div>
                ))
              )}

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  )
}
