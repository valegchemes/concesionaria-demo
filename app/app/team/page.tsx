'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, UserPlus, ShieldCheck, Mail, Phone,
  Loader2, Trash2, AlertCircle, MessageCircle,
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

function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-cyan-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
    'from-sky-500 to-blue-500',
    'from-fuchsia-500 to-violet-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
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
    name: '', email: '', password: '', role: 'SELLER', whatsappNumber: '',
  })

  useEffect(() => { void fetchInitialData() }, [])

  async function fetchInitialData() {
    try {
      const [meRes, teamRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ])
      if (meRes.ok) { const d = await meRes.json(); setMe({ id: d.id, role: d.role }) }
      if (teamRes.ok) { const d = await teamRes.json(); setMembers(d) }
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
        setFormData({ name: '', email: '', password: '', role: 'SELLER', whatsappNumber: '' })
        await fetchInitialData()
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al crear el usuario')
      }
    } catch {
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
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`No se pudo eliminar: ${data?.error || data?.message || `Error ${res.status}`}`)
      }
    } catch {
      alert('Error de conexión al intentar eliminar')
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Equipo de Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} miembro{members.length !== 1 ? 's' : ''} · {members.filter(m => m.role === 'ADMIN').length} administrador{members.filter(m => m.role === 'ADMIN').length !== 1 ? 'es' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? 'outline' : 'default'}
            size="sm"
            className="gap-1.5"
          >
            {showAddForm ? 'Cancelar' : (
              <><UserPlus className="h-4 w-4" />Añadir Miembro</>
            )}
          </Button>
        )}
      </div>

      {/* Formulario de nuevo miembro */}
      {showAddForm && isAdmin && (
        <Card className="border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/20 backdrop-blur-sm dark:border-blue-800/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Nuevo Integrante
            </CardTitle>
            <CardDescription>Crea acceso para un nuevo vendedor o administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" placeholder="Ej: Pedro González" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Corporativo</Label>
                  <Input id="email" type="email" placeholder="pedro@tudominio.com" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña de Acceso</Label>
                  <Input id="password" type="password" value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp (Solo números)</Label>
                  <Input id="whatsappNumber" placeholder="54911..." value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
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
                <Button type="submit" disabled={submitting} className="gap-1.5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Crear Cuenta
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Grid de miembros */}
      {members.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 font-semibold text-slate-700 dark:text-slate-300">No hay equipo registrado</h3>
          <p className="mt-1 text-sm text-slate-500">Añade a tu primer colaborador haciendo clic arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const gradient = getAvatarGradient(member.name)
            const isMe = member.id === me?.id

            return (
              <Card key={member.id} className="group relative overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30 hover:shadow-lg hover:shadow-black/10 transition-all duration-300">
                {/* Acento de color en la parte superior */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-70`} />

                <CardContent className="pt-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar con gradiente dinámico */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white text-lg font-bold shadow-md`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white">
                            {member.name}
                          </h3>
                          {isMe && (
                            <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-full">Tú</span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          {member.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                              <ShieldCheck className="h-3 w-3" />Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                              Vendedor
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Eliminar */}
                    {isAdmin && !isMe && (
                      <button
                        onClick={() => deleteMember(member.id, member.name)}
                        className="rounded-lg p-1.5 text-red-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 group-hover:opacity-100"
                        title="Eliminar miembro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Contacto */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.whatsappNumber && (
                      <a
                        href={`https://wa.me/${member.whatsappNumber.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 hover:text-green-700 transition-colors group/wa"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{member.whatsappNumber}</span>
                        <span className="text-[10px] opacity-0 group-hover/wa:opacity-100 transition-opacity font-medium">→ Abrir chat</span>
                      </a>
                    )}
                    {!member.whatsappNumber && (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs italic">Sin WhatsApp</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
