'use client'

import React, { useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  User,
  Wrench,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolResultCard } from './tool-result-cards'

interface CopilotChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Sugerencias rápidas ──────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  '¿Qué autos tenemos disponibles?',
  'Mostrame las estadísticas del negocio',
  'Buscame clientes nuevos sin contactar',
  '¿Cuántas ventas tuvimos este mes?',
]

// ─── Renderer de un mensaje ───────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: UIMessage }) {
  // En el SDK v6, UIMessage usa `parts` y separa los roles en user, assistant y tool.
  const textParts = msg.parts?.filter((p: any) => p.type === 'text') ?? []
  const toolCallParts = msg.parts?.filter((p: any) => p.type === 'tool-call') ?? []
  const toolResultParts = msg.parts?.filter((p: any) => p.type === 'tool-result') ?? []

  if (msg.role === 'user') {
    const text = textParts.map((p: any) => p.text).join('')
    if (!text) return null
    return (
      <div className="flex items-start gap-2.5 justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-violet-600 px-3.5 py-2.5">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 mt-0.5">
          <User className="h-3.5 w-3.5 text-slate-300" />
        </div>
      </div>
    )
  }

  if (msg.role === 'assistant') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="max-w-[82%] space-y-2">
          {/* Texto de la IA */}
          {textParts.map((part: any, i: number) => (
            part.text && (
              <div key={i} className="rounded-2xl rounded-tl-sm bg-slate-800/80 border border-white/5 px-3.5 py-2.5">
                <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{part.text}</p>
              </div>
            )
          ))}

          {/* Partes de llamadas a herramientas (loading) */}
          {toolCallParts.map((part: any, i: number) => (
            <div key={`call-${i}`} className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <Wrench className="h-3 w-3" />
              Consultando base de datos ({part.toolName})...
            </div>
          ))}
        </div>
      </div>
    )
  }

  if ((msg.role as string) === 'tool') {
    return (
      <div className="flex items-start gap-2.5">
        {/* Placeholder invisible para alinear con el avatar del assistant */}
        <div className="flex h-7 w-7 shrink-0 opacity-0" />
        <div className="max-w-[82%] space-y-2">
          {toolResultParts.map((part: any, i: number) => (
            <div key={`result-${i}`}>
              <ToolResultCard toolName={part.toolName} result={part.result} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

// ─── Panel de chat ────────────────────────────────────────────────────────────
export function CopilotChatPanel({ isOpen, onClose }: CopilotChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [inputText, setInputText] = React.useState('')

  const { messages, sendMessage, setMessages, status, error, regenerate } = useChat()

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  function handleSend() {
    const text = inputText.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInputText('')
    // Reset altura del textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function sendSuggestion(text: string) {
    sendMessage({ text })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop en mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Panel principal */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed bottom-6 right-6 z-50 flex flex-col',
              'w-[92vw] max-w-[420px] h-[600px] max-h-[80vh]',
              'rounded-2xl border border-white/10',
              'bg-slate-950/95 backdrop-blur-2xl',
              'shadow-2xl shadow-black/40',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg shadow-violet-500/25">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none">Copiloto IA</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">AutoManager CRM</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Indicador de estado */}
                {isLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-violet-400 mr-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                    Procesando...
                  </span>
                )}
                <button
                  onClick={() => setMessages([])}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Limpiar conversación"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {/* Estado vacío con sugerencias */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center pb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-600/20 ring-1 ring-violet-500/20 mb-4">
                    <Sparkles className="h-7 w-7 text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">¡Hola! Soy tu Copiloto IA</p>
                  <p className="text-xs text-slate-400 max-w-[260px] mb-6">
                    Puedo consultar tu inventario, buscar clientes, ver estadísticas y ayudarte a gestionar el negocio en lenguaje natural.
                  </p>
                  <div className="w-full space-y-2">
                    {QUICK_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendSuggestion(s)}
                        className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:border-violet-500/30 hover:text-white transition-all duration-150"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensajes */}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Indicador de escritura */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-slate-800/80 border border-white/5 px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/20 mt-0.5">
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 flex flex-col gap-2">
                    <p className="text-sm text-red-300">
                      Ocurrió un error al intentar conectarse con el servidor de inteligencia artificial.
                    </p>
                    <p className="text-xs text-red-400 font-mono bg-black/20 p-2 rounded break-all">
                      {error.message}
                    </p>
                    <button onClick={() => regenerate()} className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1.5 rounded-lg w-fit transition-colors">
                      Reintentar
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/10">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Preguntame lo que necesitás..."
                  rows={1}
                  className={cn(
                    'flex-1 resize-none rounded-xl border border-white/10 bg-white/5',
                    'px-3.5 py-2.5 text-sm text-white placeholder-slate-500',
                    'focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30',
                    'transition-all duration-150 max-h-32 leading-relaxed scrollbar-thin',
                  )}
                  style={{ minHeight: '42px' }}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                    inputText.trim() && !isLoading
                      ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/25'
                      : 'bg-white/5 text-slate-600 cursor-not-allowed',
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center mt-2">
                Shift+Enter para nueva línea · Verificá los datos importantes antes de confirmar
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
