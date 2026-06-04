'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/landing-animations'
import {
  Car, BarChart3, Users, FileSignature, ArrowRight, ShieldCheck,
  Zap, LineChart, Workflow, ChevronRight, CheckCircle2, Star,
  TrendingUp, Bell, Package, CreditCard, Sparkles, Clock,
  MessageSquare, Globe, Lock, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ─── Stats bar ─────────────────────────────────────────────── */
const stats = [
  { value: '100%', label: 'Digital' },
  { value: '+12', label: 'Módulos activos' },
  { value: 'ARS+USD', label: 'Dual moneda' },
  { value: '24/7', label: 'Disponibilidad' },
]

/* ─── Features bento grid ────────────────────────────────────── */
const features = [
  {
    icon: Car, color: 'blue', span: 'md:col-span-2',
    title: 'Inventario Multirubro',
    desc: 'Controlá el stock de autos, motos y náutica. Costos ocultos, múltiples fotos, estado de preparación y precios en ARS y USD automáticamente.',
  },
  {
    icon: Workflow, color: 'emerald', span: '',
    title: 'CRM Kanban',
    desc: 'Embudo de ventas visual. Arrastrá leads entre etapas, desde el primer contacto hasta el cierre.',
  },
  {
    icon: BarChart3, color: 'orange', span: '',
    title: 'Analíticas en tiempo real',
    desc: 'Rentabilidad neta por unidad, comisiones y tendencias mensuales actualizadas al instante.',
  },
  {
    icon: FileSignature, color: 'purple', span: 'md:col-span-2',
    title: 'Documentos y Firma Digital',
    desc: 'Boletos de compraventa y recibos en PDF al instante. Firma digital en pantalla. Envío directo por WhatsApp.',
  },
  {
    icon: ShieldCheck, color: 'indigo', span: '',
    title: 'Roles y Auditoría',
    desc: 'Control granular por rol (Admin, Gerente, Vendedor). Panel de auditoría completo.',
  },
]

const colorMap: Record<string, { bg: string; icon: string; glow: string }> = {
  blue:    { bg: 'bg-blue-500/15',    icon: 'text-blue-400',    glow: 'bg-blue-500/10' },
  emerald: { bg: 'bg-emerald-500/15', icon: 'text-emerald-400', glow: 'bg-emerald-500/10' },
  orange:  { bg: 'bg-orange-500/15',  icon: 'text-orange-400',  glow: 'bg-orange-500/10' },
  purple:  { bg: 'bg-purple-500/15',  icon: 'text-purple-400',  glow: 'bg-purple-500/10' },
  indigo:  { bg: 'bg-indigo-500/15',  icon: 'text-indigo-400',  glow: 'bg-indigo-500/10' },
}

/* ─── Changelog ─────────────────────────────────────────────── */
const changelog = [
  {
    version: 'v2.4', date: 'Jun 2025', badge: 'Nuevo',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    items: ['Firma digital de documentos en pantalla', 'Módulo de gestoría integrado', 'Analíticas de ventas con gráficos en tiempo real'],
  },
  {
    version: 'v2.3', date: 'May 2025', badge: 'Mejoras',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    items: ['Soporte dual moneda ARS/USD en todas las vistas', 'Caja diaria y cierres de caja', 'Formateo automático de montos con separadores'],
  },
  {
    version: 'v2.2', date: 'Abr 2025', badge: 'Estabilidad',
    badgeColor: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    items: ['Corrección de cálculos en analíticas', 'Mejoras de rendimiento en dashboard', 'Nuevos filtros en tabla de operaciones'],
  },
]

/* ─── Roles ──────────────────────────────────────────────────── */
const roles = [
  {
    icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10',
    title: 'Dueños y Gerentes',
    perks: [
      'Control total de márgenes reales (precio - costo - gastos)',
      'Panel de auditoría: quién modificó cada registro y cuándo',
      'Analytics avanzados y exportación de reportes',
      'Gestión de equipo con roles granulares',
    ],
  },
  {
    icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10',
    title: 'Vendedores',
    perks: [
      'Interfaz enfocada en ventas, sin ruido visual',
      'Costos de compra ocultos para mantener el foco',
      'Acceso rápido a leads y fichas de unidades',
      'Generación de PDF y envío por WhatsApp en 1 clic',
    ],
  },
]

/* ─── Marquee ticker ─────────────────────────────────────────── */
const ticker = [
  '🚗 Inventario en tiempo real', '📊 Analíticas avanzadas', '📄 Documentos digitales',
  '💬 Integración WhatsApp', '🔒 Control de accesos', '💰 Dual moneda ARS/USD',
  '📋 Kanban de leads', '⚡ Actualizaciones en vivo',
]

/* ─── Upcoming features ──────────────────────────────────────── */
const upcoming = [
  { icon: Globe, label: 'Portal público de unidades' },
  { icon: MessageSquare, label: 'Integración con WhatsApp Business' },
  { icon: RefreshCw, label: 'Sincronización con MercadoAutos' },
  { icon: Bell, label: 'Alertas automáticas por email' },
  { icon: Package, label: 'App móvil nativa' },
  { icon: CreditCard, label: 'Facturación electrónica AFIP' },
]

export function LandingSections() {
  return (
    <>
      {/* ── Stats ── */}
      <section className="py-12 border-y border-white/5 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.1} direction="none">
                <div className="text-center">
                  <p className="text-3xl font-black text-white mb-1">{s.value}</p>
                  <p className="text-sm text-slate-400">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <div className="py-4 overflow-hidden bg-slate-950/40 border-b border-white/5">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          className="inline-flex gap-12"
        >
          {[...ticker, ...ticker].map((item, i) => (
            <span key={i} className="text-slate-500 text-xs font-medium whitespace-nowrap">{item}</span>
          ))}
        </motion.div>
      </div>

      {/* ── Features bento ── */}
      <section id="caracteristicas" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <span className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Funcionalidades
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Todo lo que necesitás,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">en un solo lugar.</span>
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Módulos diseñados específicamente para resolver los problemas reales del rubro automotriz.
              </p>
            </div>
          </FadeIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[260px]">
            {features.map((f) => {
              const c = colorMap[f.color]
              const Icon = f.icon
              return (
                <StaggerItem
                  key={f.title}
                  className={`${f.span} bg-slate-900/50 border border-slate-700/40 rounded-3xl p-8 relative overflow-hidden group hover:border-slate-600/50 transition-colors`}
                >
                  <div className={`absolute right-0 top-0 w-48 h-48 ${c.glow} rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-150`} />
                  <div className="relative z-10">
                    <div className={`${c.bg} w-11 h-11 rounded-xl flex items-center justify-center mb-5`}>
                      <Icon className={`h-5 w-5 ${c.icon}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">{f.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="py-28 px-6 bg-slate-900/20 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Users className="h-3.5 w-3.5" /> Roles de acceso
              </span>
              <h2 className="text-4xl font-extrabold mb-4">Hecho a medida de cada rol</h2>
              <p className="text-slate-400">Cada perfil ve exactamente lo que necesita, nada más.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((r, i) => {
              const Icon = r.icon
              return (
                <FadeIn key={r.title} delay={i * 0.15} direction={i === 0 ? 'right' : 'left'}>
                  <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors h-full">
                    <div className={`${r.bg} w-12 h-12 rounded-2xl flex items-center justify-center mb-6`}>
                      <Icon className={`h-6 w-6 ${r.color}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-5">{r.title}</h3>
                    <ul className="space-y-3">
                      {r.perks.map((p) => (
                        <li key={p} className="flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-slate-400 text-sm">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Changelog ── */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Clock className="h-3.5 w-3.5" /> Novedades
              </span>
              <h2 className="text-4xl font-extrabold mb-4">Siempre en evolución</h2>
              <p className="text-slate-400">Actualizaciones constantes para que tu concesionaria esté siempre al día.</p>
            </div>
          </FadeIn>
          <div className="relative">
            {/* timeline line */}
            <div className="absolute left-[116px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/30 via-slate-700/40 to-transparent hidden md:block" />
            <div className="space-y-10">
              {changelog.map((c, i) => (
                <FadeIn key={c.version} delay={i * 0.15}>
                  <div className="flex flex-col md:flex-row gap-6 md:gap-10 group">
                    {/* left label */}
                    <div className="md:w-[108px] shrink-0 flex flex-col items-start md:items-end gap-1">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${c.badgeColor}`}>{c.badge}</span>
                      <span className="text-xs text-slate-500">{c.date}</span>
                      <span className="text-xs font-mono text-slate-600">{c.version}</span>
                    </div>
                    {/* dot */}
                    <div className="hidden md:flex items-start pt-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shrink-0 mt-0.5" />
                    </div>
                    {/* content */}
                    <div className="flex-1 bg-slate-900/40 border border-slate-700/30 rounded-2xl p-6 group-hover:border-slate-600/40 transition-colors">
                      <ul className="space-y-2">
                        {c.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-300">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Upcoming ── */}
      <section className="py-24 px-6 border-t border-white/5 bg-slate-900/20">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Star className="h-3.5 w-3.5" /> Próximamente
              </span>
              <h2 className="text-3xl font-extrabold mb-3">Lo que se viene</h2>
              <p className="text-slate-400 text-sm">Funcionalidades en desarrollo para potenciar aún más tu operación.</p>
            </div>
          </FadeIn>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {upcoming.map((u) => {
              const Icon = u.icon
              return (
                <StaggerItem key={u.label}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-700/30 bg-slate-900/30 hover:border-slate-600/40 transition-colors">
                    <div className="bg-purple-500/10 p-2 rounded-lg shrink-0">
                      <Icon className="h-4 w-4 text-purple-400" />
                    </div>
                    <span className="text-sm text-slate-300 font-medium">{u.label}</span>
                    <Lock className="h-3 w-3 text-slate-600 ml-auto shrink-0" />
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full" />
        <FadeIn>
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <TrendingUp className="h-3.5 w-3.5" /> Empezá hoy
            </div>
            <h2 className="text-5xl md:text-6xl font-extrabold mb-6 text-white leading-tight">
              ¿Listo para escalar<br />tus operaciones?
            </h2>
            <p className="text-blue-200/70 text-lg mb-10 max-w-xl mx-auto">
              Ingresá con tus credenciales y empezá a gestionar la concesionaria con el estándar más alto de la industria.
            </p>
            <Link href="/login">
              <Button
                size="lg"
                className="bg-white text-blue-900 hover:bg-slate-100 font-bold px-10 py-6 text-base rounded-full shadow-2xl shadow-white/10 hover:scale-105 transition-all gap-2"
              >
                Acceder al CRM
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
