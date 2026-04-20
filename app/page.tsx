import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Car, Users, BarChart3, Globe, ArrowRight, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold">AutoManager Pro</span>
        </div>
        <div className="flex gap-4">
          <Link href="/app/dashboard">
            <Button className="bg-blue-500 hover:bg-blue-600">Entrar al Sistema</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          El CRM completo para<br />
          <span className="text-blue-400">concesionarias de usados</span>
        </h1>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          Gestiona tu inventario, leads, operaciones y catálogo público desde una sola plataforma.
          Diseñado para concesionarias de autos, motos y náutica en Argentina.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/app/dashboard">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600">
              Comenzar Ahora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Demo lista para usar • Sin registro
        </p>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-slate-800/50 p-6 rounded-xl">
            <Car className="h-10 w-10 text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Inventario</h3>
            <p className="text-gray-400 text-sm">
              Control total de tu stock con precios en ARS y USD. Fotos, especificaciones y costos.
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl">
            <Users className="h-10 w-10 text-green-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">CRM + Leads</h3>
            <p className="text-gray-400 text-sm">
              Pipeline visual con tareas obligatorias. WhatsApp integrado con plantillas personalizables.
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl">
            <BarChart3 className="h-10 w-10 text-orange-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Operaciones</h3>
            <p className="text-gray-400 text-sm">
              Seguimiento de ventas, reservas y permutas. Cálculo automático de márgenes.
            </p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl">
            <Globe className="h-10 w-10 text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Catálogo Web</h3>
            <p className="text-gray-400 text-sm">
              Mini-sitio público con tu dominio propio. Tus clientes ven tu stock actualizado.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-12">Planes Simples</h2>
        <div className="max-w-md mx-auto bg-slate-800/50 p-8 rounded-2xl border border-slate-700">
          <h3 className="text-xl font-semibold mb-2">Plan Pro</h3>
          <div className="text-4xl font-bold mb-6">
            $XX<span className="text-lg text-gray-400">/mes</span>
          </div>
          <ul className="text-left space-y-3 mb-8">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>Hasta 4 vendedores</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>Unidades ilimitadas</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>Catálogo público con dominio propio</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>WhatsApp con plantillas</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>Exportación a Excel</span>
            </li>
          </ul>
          <Link href="/app/dashboard">
            <Button className="w-full bg-blue-500 hover:bg-blue-600">
              Usar Ahora
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-10 border-t border-slate-700">
        <div className="text-center text-gray-400 text-sm">
          <p>&copy; 2024 AutoManager Pro. CRM para concesionarias de Argentina.</p>
        </div>
      </footer>
    </div>
  )
}
