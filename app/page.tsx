import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { Button } from '@/components/ui/button'
import { Car, BarChart3, Users, Wrench, ShieldCheck, ArrowRight } from 'lucide-react'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // Si ya está autenticado, redirigir directo al dashboard
  if (session?.user) {
    redirect('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Car className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">AutoManager</span>
              <span className="ml-1 text-xs text-slate-400 font-medium uppercase tracking-widest">CRM</span>
            </div>
          </div>
          <Link href="/login">
            <Button className="bg-blue-600 hover:bg-blue-500 transition-colors gap-2">
              Ingresar al sistema
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero — acceso interno */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acceso restringido · Solo personal autorizado
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight max-w-3xl">
          Sistema de gestión<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            para la concesionaria
          </span>
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mb-10">
          Gestioná tu inventario, leads, operaciones y rentabilidad desde un solo lugar.
        </p>

        <Link href="/login">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-5 text-base rounded-xl shadow-lg shadow-blue-900/40 transition-all hover:scale-105 gap-2"
          >
            Iniciar sesión
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
      </main>

      {/* Módulos del sistema */}
      <section className="container mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 rounded-2xl hover:border-slate-600/60 transition-colors">
            <Car className="h-8 w-8 text-blue-400 mb-3" />
            <h3 className="font-semibold mb-1">Inventario</h3>
            <p className="text-slate-400 text-sm">Stock de unidades con precios en ARS y USD, fotos y costos.</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 rounded-2xl hover:border-slate-600/60 transition-colors">
            <Users className="h-8 w-8 text-green-400 mb-3" />
            <h3 className="font-semibold mb-1">CRM · Leads</h3>
            <p className="text-slate-400 text-sm">Pipeline de ventas, seguimiento de clientes y tareas.</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 rounded-2xl hover:border-slate-600/60 transition-colors">
            <BarChart3 className="h-8 w-8 text-orange-400 mb-3" />
            <h3 className="font-semibold mb-1">Operaciones</h3>
            <p className="text-slate-400 text-sm">Ventas, reservas, permutas y cálculo de rentabilidad.</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/40 p-6 rounded-2xl hover:border-slate-600/60 transition-colors">
            <Wrench className="h-8 w-8 text-purple-400 mb-3" />
            <h3 className="font-semibold mb-1">Taller</h3>
            <p className="text-slate-400 text-sm">Órdenes de reparación y seguimiento de trabajos en curso.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-6">
        <div className="container mx-auto px-6 text-center text-slate-500 text-xs">
          AutoManager CRM · Uso interno exclusivo de la concesionaria
        </div>
      </footer>
    </div>
  )
}
