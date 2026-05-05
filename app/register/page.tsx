'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Store, Building2, User, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al registrar la concesionaria')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Registro completado!</h2>
          <p className="text-gray-600">
            Tu concesionaria ha sido creada exitosamente. Te estamos redirigiendo al inicio de sesión...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center flex-col items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <Store className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Crea tu cuenta SaaS
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digitaliza tu concesionaria en minutos
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-8" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 text-gray-900 border-b pb-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                Datos de la Concesionaria
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="companyName">Nombre visible</Label>
                  <Input id="companyName" name="companyName" required placeholder="Ej: Automotores Juan" />
                </div>
                <div>
                  <Label htmlFor="slug">Slug (Subdominio único)</Label>
                  <Input id="slug" name="slug" required placeholder="automotores-juan" />
                  <p className="text-xs text-gray-500 mt-1">Así accederán a tu catálogo</p>
                </div>
                <div>
                  <Label htmlFor="companyPhone">Teléfono de contacto</Label>
                  <Input id="companyPhone" name="companyPhone" required placeholder="+54 9 11 1234 5678" />
                </div>
                <div>
                  <Label htmlFor="companyEmail">Email comercial</Label>
                  <Input id="companyEmail" name="companyEmail" type="email" required placeholder="contacto@empresa.com" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2 text-gray-900 border-b pb-2">
                <User className="h-5 w-5 text-gray-400" />
                Cuenta de Administrador
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="adminName">Tu Nombre Completo</Label>
                  <Input id="adminName" name="adminName" required placeholder="Juan Pérez" />
                </div>
                <div>
                  <Label htmlFor="adminEmail">Email de acceso (Login)</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" required placeholder="juan@empresa.com" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="password">Contraseña segura</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear mi concesionaria web'}
            </Button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="text-sm text-center">
              <span className="text-gray-500">¿Ya tienes una cuenta?</span>{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Inicia sesión aquí
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
