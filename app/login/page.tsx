'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Store, ArrowRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
            Bienvenido de nuevo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa a tu panel de administración SaaS
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="companySlug">Espacio de trabajo (Slug)</Label>
              <div className="mt-1">
                <Input
                  id="companySlug"
                  name="companySlug"
                  type="text"
                  required
                  placeholder="mi-concesionaria"
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
                  placeholder="admin@concesionaria.com"
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="text-sm text-center">
              <span className="text-gray-500">¿No tienes una cuenta para tu concesionaria?</span>{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Regístrate ahora
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
