'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Car, ArrowRight, AlertCircle, Users, Briefcase,
  ShieldCheck, BarChart3, FileSignature, Workflow, Lock, Eye, EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  { icon: BarChart3,     label: 'Analíticas en tiempo real' },
  { icon: Workflow,      label: 'Pipeline Kanban de leads' },
  { icon: FileSignature, label: 'Documentos y firma digital' },
  { icon: ShieldCheck,   label: 'Control de accesos por rol' },
]

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<'admin' | 'staff'>('staff')
  const [showPwd, setShowPwd] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)

    try {
      const res = await signIn('credentials', {
        email:       fd.get('email') as string,
        password:    fd.get('password') as string,
        companySlug: fd.get('companySlug') as string,
        redirect:    false,
      })
      if (res?.error) {
        setError('Credenciales inválidas o empresa no encontrada')
      } else {
        router.push('/app/dashboard')
        router.refresh()
      }
    } catch {
      setError('Ocurrió un error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080C14] flex">

      {/* ── LEFT: Branding panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/20 blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[120px]" />
        </div>

        {/* Grid texture */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Car className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">
            AutoManager
            <span className="ml-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 align-middle">
              CRM
            </span>
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
              El motor detrás de tu<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                concesionaria digital
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Gestioná inventario, leads, documentos y analíticas desde una sola plataforma.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            className="mt-10 flex flex-col gap-3"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.4 } } }}
          >
            {features.map((f) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.label}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show:   { opacity: 1, x: 0, transition: { duration: 0.5 } },
                  }}
                  className="flex items-center gap-3"
                >
                  <div className="bg-blue-500/10 border border-blue-500/20 p-1.5 rounded-lg">
                    <Icon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-slate-300 text-sm">{f.label}</span>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        {/* Bottom caption */}
        <p className="relative z-10 text-slate-600 text-xs">
          © {new Date().getFullYear()} AutoManager CRM · Software privado de uso exclusivo
        </p>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
            <Car className="h-4 w-4 text-white" />
          </div>
          <span className="text-white text-lg font-bold">AutoManager CRM</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="w-full max-w-[400px]"
        >
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Bienvenido de vuelta</h2>
            <p className="text-slate-400 text-sm">Ingresá con tus credenciales para continuar</p>
          </div>

          {/* Tab selector */}
          <div className="flex p-1 bg-slate-800/60 rounded-xl mb-7 border border-slate-700/50">
            {(['staff', 'admin'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all duration-200',
                  tab === t
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {t === 'staff'
                  ? <><Users className="h-3.5 w-3.5" /> Personal</>
                  : <><Briefcase className="h-3.5 w-3.5" /> Administrador</>
                }
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="companySlug" className="text-slate-300 text-xs font-semibold uppercase tracking-wide">
                Identificador de concesionaria
              </Label>
              <Input
                id="companySlug"
                name="companySlug"
                type="text"
                required
                placeholder="ej: mi-concesionaria"
                disabled={loading}
                className="h-11 bg-slate-800/60 border-slate-700/60 text-white placeholder:text-slate-600 focus-visible:border-blue-500/70 focus-visible:ring-blue-500/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wide">
                Correo electrónico
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={tab === 'staff' ? 'tu@email.com' : 'admin@concesionaria.com'}
                disabled={loading}
                className="h-11 bg-slate-800/60 border-slate-700/60 text-white placeholder:text-slate-600 focus-visible:border-blue-500/70 focus-visible:ring-blue-500/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wide">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="h-11 bg-slate-800/60 border-slate-700/60 text-white placeholder:text-slate-600 focus-visible:border-blue-500/70 focus-visible:ring-blue-500/20 rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl
                         shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-10px_rgba(37,99,235,0.6)]
                         transition-all gap-2 text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Ingresar al sistema
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </>
              )}
            </Button>
          </form>

          {tab === 'admin' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center text-sm text-slate-500"
            >
              ¿Sin cuenta aún?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                Registrá tu concesionaria
              </Link>
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
