'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Sparkles } from 'lucide-react'
import { CopilotChatPanel } from './chat-panel'
import { cn } from '@/lib/utils'

export function CopilotButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Panel de chat */}
      <CopilotChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Botón flotante */}
      <AnimatePresence mode="wait">
        <motion.button
          key={isOpen ? 'close' : 'open'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            'shadow-2xl transition-all duration-200',
            isOpen
              ? 'bg-slate-800 border border-white/10 shadow-black/40 hover:bg-slate-700'
              : 'bg-gradient-to-br from-violet-600 to-blue-700 shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105',
          )}
          title={isOpen ? 'Cerrar Copiloto' : 'Abrir Copiloto IA'}
        >
          {/* Pulso animado cuando está cerrado */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-2xl animate-ping bg-violet-600/40" />
          )}
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-5 w-5 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                <Bot className="h-6 w-6 text-white" />
                <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-300" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </AnimatePresence>
    </>
  )
}
