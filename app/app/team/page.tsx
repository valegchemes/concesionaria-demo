'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  UserPlus,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  whatsappNumber?: string
}

interface CurrentUser {
  id: string
  role: string
}

export default function TeamPage() {
  const router = useRouter()
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SELLER',
    whatsappNumber: '',
  })

  useEffect(() => {
    void fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      const [meRes, teamRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ])

      if (meRes.ok) {
        const meData = await meRes.json()
        setMe({ id: meData.id, role: meData.role })
      }

      if (teamRes.ok) {
        const data = await teamRes.json()
        setMembers(data)
      }
    } catch (err) {
      console.error('Error fetching team:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setShowAddForm(false)
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'SELLER',
          whatsappNumber: '',
        })
        await fetchInitialData()
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al crear el usuario')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`Eliminar a ${name} del equipo? Esta accion no se puede deshacer.`)) return

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
        setMembers(prev => prev.filter(m => m.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        const msg = data?.error || data?.message || `Error ${res.status}`
        alert(`No se pudo eliminar el miembro: ${msg}`)
      }
    } catch {
      alert('Error de conexion al intentar eliminar')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const isAdmin = me?.role === 'ADMIN'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipo de Ventas</h1>
          <p className="text-muted-foreground">
            Gestiona los vendedores y administradores de tu concesionaria.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancelar' : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Anadir Miembro
              </>
            )}
          </Button>
        )}
      </div>

      {showAddForm && isAdmin && (
        <Card className="border-blue-100 bg-blue-50/10">
          <CardHeader>
            <CardTitle className="text-lg">Nuevo Integrante</CardTitle>
            <CardDescription>Crea un acceso para un nuevo vendedor o administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Pedro Gonzalez"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Corporativo / Acceso</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="pedro@tudominio.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contrasena de Acceso</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp (Solo numeros)</Label>
                  <Input
                    id="whatsappNumber"
                    placeholder="54911..."
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol en el sistema</Label>
                  <select
                    id="role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="SELLER">Vendedor (Acceso limitado)</option>
                    <option value="ADMIN">Administrador (Control total)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Crear Cuenta de Equipo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <Card key={member.id} className="group relative">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                      {member.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {member.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          Vendedor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && member.id !== me?.id && (
                  <button
                    onClick={() => deleteMember(member.id, member.name)}
                    className="rounded-md p-1.5 text-red-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Eliminar miembro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </div>
                {member.whatsappNumber && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="h-4 w-4" />
                    {member.whatsappNumber}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && (
        <div className="rounded-lg border-2 border-dashed bg-slate-50 py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 font-semibold text-slate-900">No hay equipo registrado</h3>
          <p className="text-slate-500">Anade a tu primer colaborador haciendo clic arriba.</p>
        </div>
      )}
    </div>
  )
}
