'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Store, ArrowRight, AlertCircle, Users, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'admin' | 'staff'>('staff')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const companySlug = formData.get('companySlug') as string

    try {
      const res = await signIn('credentials', {
        email,
        password,
        companySlug,
        redirect: false,
      })

      if (res?.error) {
        setError('Credenciales inválidas o empresa no encontrada')
      } else {
        router.push('/app/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Ocurrió un error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center flex-col items-center">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Ingreso al Sistema
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Seleccioná tu perfil para continuar
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {/* Tabs Selector */}
          <div className="flex p-1 bg-slate-100 rounded-lg mb-8">
            <button
              onClick={() => { setTab('staff'); setError(''); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all",
                tab === 'staff' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users className="h-4 w-4" /> Personal / Vendedor
            </button>
            <button
              onClick={() => { setTab('admin'); setError(''); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all",
                tab === 'admin' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Briefcase className="h-4 w-4" /> Administrador
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800">
              {tab === 'staff' ? 'Portal del Personal' : 'Panel de Administración'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {tab === 'staff' 
                ? 'Ingresá con las credenciales que te proporcionó el administrador de tu concesionaria.'
                : 'Ingresá para gestionar tu negocio, agregar usuarios y ver rentabilidad.'}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="companySlug">Identificador de Concesionaria</Label>
              <div className="mt-1">
                <Input
                  id="companySlug"
                  name="companySlug"
                  type="text"
                  required
                  placeholder="ej: mi-concesionaria"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={tab === 'staff' ? "tu@email.com" : "admin@concesionaria.com"}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </form>

          {tab === 'admin' && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="text-sm text-center">
                <span className="text-gray-500">¿No tienes una cuenta para tu concesionaria?</span>{' '}
                <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Regístrate ahora
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
