'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Bot,
  MessageSquareText,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Loader2,
  PlugZap,
  LogOut
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'

type EmailInteraction = {
  id: string
  fromEmail: string
  subject: string
  messageBody: string
  replyBody: string
  createdAt: string
}

type ConnectionStatus = {
  connected: boolean
  emailAddress: string | null
  interactions: EmailInteraction[]
}

export default function EmailAIPage() {
  const { limits, loading: limitsLoading } = usePlanLimits()
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/email/gmail/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (error) {
      console.error(error)
      toast.error('Error al cargar estado de la conexión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Poll every 30 seconds for new emails in the feed if connected
    const interval = setInterval(() => {
      if (status?.connected) {
        fetchStatus()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [status?.connected])

  const handleConnect = () => {
    window.location.href = '/api/email/gmail/auth'
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de desconectar tu cuenta de Gmail? El auto-responder dejará de funcionar.')) return
    
    setDisconnecting(true)
    try {
      const res = await fetch('/api/email/gmail/disconnect', { method: 'POST' })
      if (res.ok) {
        toast.success('Cuenta desconectada exitosamente.')
        fetchStatus()
      } else {
        toast.error('Hubo un error al desconectar la cuenta.')
      }
    } catch (err) {
      toast.error('Error de red al intentar desconectar.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (limitsLoading || loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // 1. GOBERNANZA: Bloquear si no tiene el Plan Pro (aiEnabled = false)
  if (!limits?.aiEnabled) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center pt-24 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-violet-500/10 ring-8 ring-violet-500/5">
          <Lock className="h-10 w-10 text-violet-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-100">
          Auto-responder de Email con IA
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Esta función automatiza el 100% de la respuesta inicial a tus prospectos por correo electrónico leyendo tu catálogo en tiempo real. 
          <br className="hidden md:block" /> 
          Requiere el <span className="font-semibold text-violet-400">Plan Pro</span>.
        </p>
        <Link
          href="/app/settings/billing"
          className="mt-8 flex items-center justify-center rounded-lg bg-violet-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:bg-violet-500 hover:shadow-violet-500/30 active:scale-95"
        >
          Mejorar al Plan Pro
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl pb-24">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/settings"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              ← Volver
            </Link>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              Email Comercial con IA <Bot className="h-6 w-6 text-violet-400" />
            </h1>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-400 ring-1 ring-inset ring-violet-500/20">
              PREMIUM
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Conectá tu cuenta de Gmail para que la Inteligencia Artificial intercepte y responda automáticamente a los clientes interesados.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Columna Izquierda: Configuración y Conexión */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
                  <PlugZap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200">Conexión con Gmail</h3>
                  <p className="text-xs text-slate-400">
                    Sincronización IMAP/SMTP en tiempo real
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${status?.connected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {status?.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>

            {status?.connected ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Cuenta enlazada exitosamente</p>
                    <p className="mt-1 font-mono text-sm text-slate-300">{status.emailAddress}</p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Desconectar
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  La IA está escuchando nuevos correos automáticamente cada 5 minutos.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Mail className="mb-4 h-12 w-12 text-slate-500" />
                <h4 className="mb-2 text-lg font-medium text-slate-200">Enlazá tu bandeja de entrada</h4>
                <p className="mb-6 max-w-sm text-sm text-slate-400">
                  Autorizá el acceso a tu cuenta de Gmail mediante Google OAuth para permitir a la IA leer tus correos entrantes y enviar respuestas.
                </p>
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-transform hover:scale-105 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Conectar con Google
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
            <h4 className="mb-2 flex items-center gap-2 font-medium text-violet-400">
              <Zap className="h-5 w-5" />
              ¿Cómo funciona en vivo?
            </h4>
            <p className="text-sm text-slate-400">
              Una vez conectado, nuestro cron automatizado revisa tu buzón cada 5 minutos buscando correos <strong className="text-slate-300">no leídos</strong>.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li className="flex gap-2">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Lee el mensaje y extrae la intención del cliente.
              </li>
              <li className="flex gap-2">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Busca en tu base de datos el vehículo mencionado o sugiere alternativas de tu catálogo real.
              </li>
              <li className="flex gap-2">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Redacta un correo persuasivo en voseo argentino con la Ficha Pública y simulación de cuotas.
              </li>
              <li className="flex gap-2">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Envía el correo directamente desde tu casilla.
              </li>
            </ul>
          </div>
        </div>

        {/* Columna Derecha: Bandeja en Vivo */}
        <div className="flex flex-col">
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl backdrop-blur-sm">
            <div className="border-b border-slate-800 bg-slate-900/80 p-4">
              <h3 className="flex items-center gap-2 font-medium text-slate-200">
                <Globe className="h-5 w-5 text-sky-400" />
                Flujo de Actividad en Vivo
              </h3>
              <p className="text-xs text-slate-400">Últimos correos procesados y respondidos de forma autónoma.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {!status?.connected ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageSquareText className="mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">Conectá tu cuenta para ver el flujo en vivo.</p>
                </div>
              ) : status.interactions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <MessageSquareText className="mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">Esperando el primer correo...</p>
                  <p className="mt-1 text-xs text-slate-600">Aún no se ha interceptado ningún email no leído.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence>
                    {status.interactions.map((interaction) => (
                      <motion.div
                        key={interaction.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-slate-700 pb-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">
                              De: <span className="font-normal text-slate-400">{interaction.fromEmail}</span>
                            </p>
                            <p className="text-xs font-semibold text-slate-300">
                              Asunto: <span className="font-normal text-slate-400">{interaction.subject}</span>
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(interaction.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Mensaje Original:</p>
                          <p className="text-xs text-slate-400 line-clamp-3 italic">
                            "{interaction.messageBody}"
                          </p>
                        </div>
                        <div className="rounded-lg bg-violet-500/10 p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                            <Bot className="h-3.5 w-3.5" />
                            Respuesta Enviada por IA:
                          </p>
                          <div 
                            className="text-xs text-slate-300 prose prose-invert max-w-none prose-p:my-1"
                            dangerouslySetInnerHTML={{ __html: interaction.replyBody }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
