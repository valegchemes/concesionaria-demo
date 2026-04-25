'use client'

import { useState, useEffect } from 'react'
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
  AlertCircle
} from 'lucide-react'
import { useSession } from 'next-auth/react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  whatsappNumber?: string
}

export default function TeamPage() {
  const { data: session } = useSession()
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
    fetchTeam()
  }, [])

  async function fetchTeam() {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
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
        fetchTeam()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al crear el usuario')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteMember(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} del equipo? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'Error al eliminar el miembro')
      }
    } catch (err) {
      console.error('Error deleting member:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
                <UserPlus className="h-4 w-4 mr-2" />
                Añadir Miembro
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
                <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm border border-red-100">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ej: Pedro González"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña de Acceso</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp (Solo números)</Label>
                  <Input 
                    id="whatsappNumber" 
                    placeholder="54911..."
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol en el sistema</Label>
                  <select 
                    id="role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="SELLER">Vendedor (Acceso limitado)</option>
                    <option value="ADMIN">Administrador (Control total)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Crear Cuenta de Equipo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card key={member.id} className="relative group">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {member.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {member.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                          Vendedor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && member.id !== session?.user?.id && (
                  <button
                    onClick={() => deleteMember(member.id, member.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50"
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
        <div className="text-center py-20 bg-slate-50 rounded-lg border-2 border-dashed">
          <Users className="h-12 w-12 mx-auto text-slate-300" />
          <h3 className="mt-4 font-semibold text-slate-900">No hay equipo registrado</h3>
          <p className="text-slate-500">Añade a tu primer colaborador haciendo clic arriba.</p>
        </div>
      )}
    </div>
  )
}
