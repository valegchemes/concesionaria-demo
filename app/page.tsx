import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { Button } from '@/components/ui/button'
import {
  Car, BarChart3, Users, FileSignature, 
  ArrowRight, ShieldCheck, Zap, 
  LineChart, Workflow, ChevronRight
} from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/landing-animations'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // Si ya está autenticado, redirigir directo al dashboard
  if (session?.user) {
    redirect('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white selection:bg-blue-500/30 overflow-hidden font-sans">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 backdrop-blur-md bg-[#0B0F19]/60 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Car className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-100">AutoManager</span>
              <span className="ml-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">CRM</span>
            </div>
          </div>
          <Link href="/login">
            <Button variant="outline" className="hidden sm:flex border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-all rounded-full px-6">
              Acceso Staff
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="relative pt-24 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
          <FadeIn delay={0.1}>
            <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 text-slate-300 text-xs font-medium px-4 py-1.5 rounded-full mb-8 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Plataforma de uso interno exclusivo
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight max-w-4xl mx-auto">
              El motor detrás de tu <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                concesionaria digital
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Abandoná las planillas de Excel. Centralizá tu inventario, automatizá el seguimiento de leads y analizá tu rentabilidad real en una única plataforma ultra rápida.
            </p>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/login">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-6 text-base rounded-full shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.7)] transition-all hover:-translate-y-0.5 gap-2 w-full sm:w-auto">
                  Iniciar sesión ahora
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#caracteristicas" className="group flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors px-6 py-4">
                Descubrir funciones
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </FadeIn>

          {/* MOCKUP IMAGE */}
          <FadeIn delay={0.6} className="mt-20 w-full max-w-5xl mx-auto perspective-[2000px]">
            <div className="relative rounded-2xl md:rounded-[2rem] border border-white/10 bg-slate-900/50 p-2 md:p-4 shadow-2xl shadow-black/50 backdrop-blur-sm transform rotate-x-[2deg] hover:rotate-x-0 transition-transform duration-700 ease-out">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent z-10 rounded-[2rem] pointer-events-none" />
              <img 
                src="/crm-mockup.png" 
                alt="AutoManager CRM Dashboard Preview" 
                className="rounded-xl md:rounded-2xl w-full h-auto object-cover border border-white/5"
              />
            </div>
          </FadeIn>
        </section>

        {/* BENTO GRID (FEATURES) */}
        <section id="caracteristicas" className="py-24 px-6 bg-slate-900/20 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="mb-16 md:mb-20 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitás, <br/><span className="text-blue-400">en un solo lugar.</span></h2>
                <p className="text-slate-400 max-w-xl">Módulos diseñados específicamente para resolver los problemas reales del rubro automotriz.</p>
              </div>
            </FadeIn>

            <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
              {/* Feature 1 (Large) */}
              <StaggerItem className="md:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all group-hover:bg-blue-500/20" />
                <div className="relative z-10">
                  <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                    <Car className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Gestión de Inventario Multirubro</h3>
                  <p className="text-slate-400 leading-relaxed max-w-md">
                    Controlá el stock de autos, motos y náutica. Registrá costos ocultos, múltiples fotos, estado de preparación y calculá precios en ARS y USD automáticamente.
                  </p>
                </div>
              </StaggerItem>

              {/* Feature 2 (Square) */}
              <StaggerItem className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl transition-all group-hover:bg-emerald-500/20" />
                <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Workflow className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">CRM y Kanban</h3>
                <p className="text-slate-400 text-sm">
                  Visualizá tu embudo de ventas. Arrastrá leads entre etapas, desde el primer contacto hasta el cierre de la operación.
                </p>
              </StaggerItem>

              {/* Feature 3 (Square) */}
              <StaggerItem className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl transition-all group-hover:bg-orange-500/20" />
                <div className="bg-orange-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Finanzas y Permisos</h3>
                <p className="text-slate-400 text-sm">
                  Seguimiento de rentabilidad neta. Permisos granulares (RBAC) para ocultar costos de adquisición a los vendedores.
                </p>
              </StaggerItem>

              {/* Feature 4 (Large) */}
              <StaggerItem className="md:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 md:p-10 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all group-hover:bg-purple-500/20" />
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="flex-1">
                    <div className="bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                      <FileSignature className="h-6 w-6 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Automatización y Papeles</h3>
                    <p className="text-slate-400 leading-relaxed max-w-md">
                      Generá boletos de compraventa y recibos en PDF al instante. Capturá la firma digital de tus clientes en pantalla y enviales los documentos directo por WhatsApp.
                    </p>
                  </div>
                  <div className="hidden md:flex gap-4">
                    {/* Abstract illustration of the feature */}
                    <div className="w-32 h-32 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center relative">
                      <div className="absolute inset-x-4 top-4 h-2 bg-slate-700 rounded-full" />
                      <div className="absolute inset-x-4 top-8 h-2 w-1/2 bg-slate-700 rounded-full" />
                      <div className="w-20 h-10 border border-blue-500/30 bg-blue-500/10 rounded-lg flex items-center justify-center mt-6">
                        <span className="text-[8px] text-blue-400 font-mono">Firma OK</span>
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </div>
        </section>

        {/* ROLES / BENEFITS SECTION */}
        <section className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <FadeIn>
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Hecho a medida de cada rol</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">Distintos perfiles tienen distintas necesidades. El sistema se adapta a quién lo esté usando.</p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FadeIn direction="right">
                <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <Users className="h-10 w-10 text-indigo-400 mb-6" />
                  <h3 className="text-2xl font-semibold mb-4 text-slate-100">Para Dueños y Gerentes</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-indigo-500/20 p-1 rounded-full"><LineChart className="h-3 w-3 text-indigo-400" /></div>
                      <span className="text-slate-400">Control absoluto sobre los márgenes reales de ganancia (Precio Venta - Costo - Gastos).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-indigo-500/20 p-1 rounded-full"><ShieldCheck className="h-3 w-3 text-indigo-400" /></div>
                      <span className="text-slate-400">Panel de auditoría: sabé exactamente quién borró, modificó o creó cada registro.</span>
                    </li>
                  </ul>
                </div>
              </FadeIn>

              <FadeIn direction="left">
                <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <Zap className="h-10 w-10 text-yellow-400 mb-6" />
                  <h3 className="text-2xl font-semibold mb-4 text-slate-100">Para Vendedores</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-yellow-500/20 p-1 rounded-full"><ArrowRight className="h-3 w-3 text-yellow-400" /></div>
                      <span className="text-slate-400">Interfaz simplificada. Los costos de compra se ocultan para mantener el foco en la venta.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-yellow-500/20 p-1 rounded-full"><ArrowRight className="h-3 w-3 text-yellow-400" /></div>
                      <span className="text-slate-400">Accesos rápidos a reservas, generación de PDFs en 1 click y envío por WhatsApp.</span>
                    </li>
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* CTA BOTTOM */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-600/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-blue-600/20 blur-[100px] rounded-full" />
          
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <FadeIn>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">¿Listo para escalar tus operaciones?</h2>
              <p className="text-blue-200 text-lg mb-10 max-w-2xl mx-auto">
                Ingresá con tus credenciales de empleado y empezá a gestionar la concesionaria con el estándar más alto de la industria.
              </p>
              <Link href="/login">
                <Button size="lg" className="bg-white text-blue-900 hover:bg-slate-100 font-bold px-10 py-6 text-lg rounded-full shadow-2xl shadow-white/10 hover:scale-105 transition-transform">
                  Acceder al CRM
                </Button>
              </Link>
            </FadeIn>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-semibold text-slate-300">AutoManager <span className="text-slate-500">CRM</span></span>
          </div>
          <p className="text-slate-500 text-xs text-center md:text-right">
            © {new Date().getFullYear()} · Software Privado · Uso exclusivo de la concesionaria
          </p>
        </div>
      </footer>
    </div>
  )
}
