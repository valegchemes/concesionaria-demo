import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { Button } from '@/components/ui/button'
import { Car, ArrowRight, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/landing-animations'
import { LandingSections } from '@/components/landing-sections'

export const metadata = {
  title: 'AutoManager CRM — El motor detrás de tu concesionaria digital',
  description:
    'Gestioná inventario, leads, operaciones, documentos y analíticas desde una sola plataforma diseñada para concesionarias argentinas.',
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/app/dashboard')

  return (
    <div className="min-h-screen bg-[#080C14] text-white selection:bg-blue-500/30 overflow-x-hidden font-sans">

      {/* ── Ambient background orbs ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-blue-700/20 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-700/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-violet-700/10 blur-[100px]" />
      </div>

      {/* ── Sticky header ── */}
      <header className="relative z-50 sticky top-0 border-b border-white/5 bg-[#080C14]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Car className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              AutoManager
              <span className="ml-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 align-middle">
                CRM
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#caracteristicas" className="hidden sm:block text-sm text-slate-400 hover:text-white transition-colors">
              Funciones
            </a>
            <Link href="/login">
              <Button
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full px-5"
              >
                Acceso Staff
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* ── Hero ── */}
        <section className="relative pt-28 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
          {/* subtle grid */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none" />

          <FadeIn delay={0.05}>
            <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs font-medium px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Plataforma privada para concesionarias
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight max-w-4xl mx-auto mb-6">
              El motor detrás de tu{' '}
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                concesionaria digital
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.25}>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Abandoná las planillas de Excel. Centralizá tu inventario, automatizá el seguimiento
              de leads y analizá tu rentabilidad real en una única plataforma ultra rápida.
            </p>
          </FadeIn>

          <FadeIn delay={0.35}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-6 text-base rounded-full
                             shadow-[0_0_50px_-12px_rgba(37,99,235,0.55)] hover:shadow-[0_0_70px_-12px_rgba(37,99,235,0.75)]
                             transition-all hover:-translate-y-0.5 gap-2 w-full sm:w-auto"
                >
                  Iniciar sesión
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a
                href="#caracteristicas"
                className="group flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-3"
              >
                Ver funciones
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </FadeIn>

          {/* Hero mockup */}
          <FadeIn delay={0.5} className="mt-20 w-full max-w-5xl mx-auto">
            <div className="relative rounded-[2rem] border border-white/10 bg-slate-900/50 p-3 shadow-2xl shadow-black/60 backdrop-blur-sm
                            hover:[transform:rotateX(1deg)] transition-transform duration-700">
              <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-transparent to-transparent z-10 rounded-[2rem] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent z-10 rounded-[2rem] pointer-events-none" />
              <img
                src="/crm-mockup.png"
                alt="AutoManager CRM Dashboard"
                className="rounded-2xl w-full h-auto object-cover border border-white/5"
              />
              {/* floating badge */}
              <div className="absolute bottom-8 right-8 z-20 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                <div className="bg-emerald-500/20 p-1.5 rounded-lg">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Datos en tiempo real</p>
                  <p className="text-[10px] text-slate-400">Actualización automática</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── All remaining sections (client component) ── */}
        <LandingSections />

      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-10 bg-[#080C14]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 rounded-lg">
              <Car className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-300">
              AutoManager <span className="text-slate-500 font-normal">CRM</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <span>Software privado</span>
            <span>·</span>
            <span>Uso exclusivo de la concesionaria</span>
            <span>·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
