'use client'
import { toast } from 'sonner'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, UserPlus, ShieldCheck, Mail, Phone,
  Loader2, Trash2, AlertCircle, MessageCircle, Pencil, Camera, X, Lock
} from 'lucide-react'
import Image from 'next/image'
import { usePlanLimits } from '@/lib/hooks/use-plan-limits'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  whatsappNumber?: string
  avatarUrl?: string
  commissionRate: number
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
  const { limits } = usePlanLimits()
  const { user: me } = useCurrentUser()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'SELLER', whatsappNumber: '', commissionRate: 0,
  })

  // Edit State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '', email: '', password: '', role: 'SELLER', whatsappNumber: '', avatarUrl: '', commissionRate: 0,
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string>('')
  const pendingAvatarUrlRef = useRef<string>('')

  useEffect(() => { void fetchInitialData() }, [])

  async function fetchInitialData() {
    try {
      const teamRes = await fetch('/api/users', { cache: 'no-store' })
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
        setFormData({ name: '', email: '', password: '', role: 'SELLER', whatsappNumber: '', commissionRate: 0 })
        await fetchInitialData()
        router.refresh()
      } else {
        const data = await res.json()
        const errorMsg = typeof data.error === 'string' 
          ? data.error 
          : Array.isArray(data.error) 
            ? data.error[0]?.message || 'Error de validación'
            : 'Error al crear el usuario'
        setError(errorMsg)
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
        toast.error(`No se pudo eliminar: ${data?.error || data?.message || `Error ${res.status}`}`)
      }
    } catch {
      toast.error('Error de conexión al intentar eliminar')
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMember) return
    setEditSubmitting(true)
    setEditError('')
    try {
      let finalAvatarUrl = editFormData.avatarUrl
      
      if (pendingAvatarFile) {
        setUploadingImage(true)
        try {
          const { upload } = await import('@vercel/blob/client')
          const blob = await upload(`avatars/${pendingAvatarFile.name}`, pendingAvatarFile, {
            access: 'public',
            handleUploadUrl: '/api/blob',
          })
          finalAvatarUrl = blob.url
        } catch (err) {
          console.error('Error uploading avatar', err)
          setEditError('Error al subir la imagen')
          return
        } finally {
          setUploadingImage(false)
        }
      }
      
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingMember.id, ...editFormData, avatarUrl: finalAvatarUrl }),
      })
      if (res.ok) {
        if (pendingAvatarUrlRef.current) {
          URL.revokeObjectURL(pendingAvatarUrlRef.current)
          pendingAvatarUrlRef.current = ''
        }
        setPendingAvatarFile(null)
        setPendingAvatarPreview('')
        setEditingMember(null)
        await fetchInitialData()
        router.refresh()
      } else {
        const data = await res.json()
        const errorMsg = typeof data.error === 'string' 
          ? data.error 
          : Array.isArray(data.error) 
            ? data.error[0]?.message || 'Error de validación'
            : 'Error al actualizar el usuario'
        setEditError(errorMsg)
      }
    } catch {
      setEditError('Error de conexión')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    if (pendingAvatarUrlRef.current) {
      URL.revokeObjectURL(pendingAvatarUrlRef.current)
      pendingAvatarUrlRef.current = ''
    }
    
    const previewUrl = URL.createObjectURL(file)
    pendingAvatarUrlRef.current = previewUrl
    setPendingAvatarFile(file)
    setPendingAvatarPreview(previewUrl)
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
          <h1 className="text-xl font-bold text-adaptive-primary">Equipo de Ventas</h1>
          <p className="text-sm text-adaptive-secondary mt-0.5">
            {members.length} miembro{members.length !== 1 ? 's' : ''} de {limits.maxUsers} · {members.filter(m => m.role === 'ADMIN').length} administrador{members.filter(m => m.role === 'ADMIN').length !== 1 ? 'es' : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {members.length >= limits.maxUsers && (
              <Link
                href="/app/settings/billing"
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
              >
                <Lock className="h-3 w-3" />
                Límite de plan ({limits.maxUsers} usuarios)
              </Link>
            )}
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant={showAddForm ? 'outline' : 'default'}
              size="sm"
              className="gap-1.5"
              disabled={members.length >= limits.maxUsers}
              title={members.length >= limits.maxUsers ? `Tu plan permite hasta ${limits.maxUsers} usuario${limits.maxUsers === 1 ? '' : 's'}` : undefined}
            >
              {showAddForm ? 'Cancelar' : (
                <><UserPlus className="h-4 w-4" />Añadir Miembro</>
              )}
            </Button>
          </div>
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
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">Comisión (%)</Label>
                  <Input id="commissionRate" type="number" min="0" max="100" step="0.1" placeholder="Ej: 2.5" value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })} />
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
                <Button type="submit" disabled={submitting} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Crear Cuenta
                </Button>
              </div>

              {me?.companySlug && (
                <div className="mt-4 rounded-md bg-blue-50/50 dark:bg-blue-900/20 p-3 border border-blue-100 dark:border-blue-800/50">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Importante:</strong> Para ingresar al sistema, este usuario necesitará su <strong>Email</strong>, la <strong>Contraseña</strong> que le asignaste arriba, y el Identificador de la Concesionaria: <code className="font-mono bg-white dark:bg-blue-950 px-1.5 py-0.5 rounded border">{me.companySlug}</code>
                  </p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Grid de miembros */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-white/10 surface-secondary py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-adaptive-secondary opacity-50" />
          <h3 className="mt-4 font-semibold text-adaptive-primary">No hay equipo registrado</h3>
          <p className="mt-1 text-sm text-adaptive-secondary">Añade a tu primer colaborador haciendo clic arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const gradient = getAvatarGradient(member.name)
            const isMe = member.id === me?.id

            return (
              <Card key={member.id} className="group relative overflow-hidden surface-primary hover:-translate-y-1 transition-transform duration-300">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-70`} />

                <CardContent className="pt-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {member.avatarUrl ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden shadow-md border-2 border-white/50">
                          <Image src={member.avatarUrl} alt={member.name} width={48} height={48} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white text-lg font-bold shadow-md`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-adaptive-primary">
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

                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => {
                            if (pendingAvatarUrlRef.current) {
                              URL.revokeObjectURL(pendingAvatarUrlRef.current)
                              pendingAvatarUrlRef.current = ''
                            }
                            setPendingAvatarFile(null)
                            setPendingAvatarPreview('')
                            setEditingMember(member)
                            setEditFormData({
                              name: member.name,
                              email: member.email,
                              password: '',
                              role: member.role,
                              whatsappNumber: member.whatsappNumber || '',
                              avatarUrl: member.avatarUrl || '',
                              commissionRate: member.commissionRate || 0
                            })
                          }}
                          className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"
                          title="Editar miembro"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!isMe && (
                          <button
                            onClick={() => deleteMember(member.id, member.name)}
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            title="Eliminar miembro"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-adaptive-secondary">
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

      {/* Modal de Edición */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                if (pendingAvatarUrlRef.current) {
                  URL.revokeObjectURL(pendingAvatarUrlRef.current)
                  pendingAvatarUrlRef.current = ''
                }
                setPendingAvatarFile(null)
                setPendingAvatarPreview('')
                setEditingMember(null)
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Editar Miembro</h2>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {editError}
                </div>
              )}
              
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="relative group">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-lg bg-slate-100 flex items-center justify-center">
                    {(pendingAvatarPreview || editFormData.avatarUrl) ? (
                      <Image 
                        src={pendingAvatarPreview || editFormData.avatarUrl} 
                        alt="Avatar" 
                        width={80} 
                        height={80} 
                        className="h-full w-full object-cover" 
                      />
                    ) : (
                      <Users className="h-8 w-8 text-slate-400" />
                    )}
                    {pendingAvatarPreview && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <span className="text-white text-[10px] font-medium">Preview</span>
                      </div>
                    )}
                  </div>
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingAvatarPreview ? 'Nueva foto - se subirá al guardar' : 'Click para subir foto'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input required value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Nueva Contraseña (Opcional)</Label>
                  <Input type="password" placeholder="Dejar en blanco para mantener actual" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input placeholder="54911..." value={editFormData.whatsappNumber} onChange={e => setEditFormData({...editFormData, whatsappNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Comisión (%)</Label>
                  <Input type="number" min="0" max="100" step="0.1" placeholder="Ej: 2.5" value={editFormData.commissionRate} onChange={e => setEditFormData({...editFormData, commissionRate: parseFloat(e.target.value) || 0})} />
                </div>
                {me?.id !== editingMember.id && (
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editFormData.role}
                      onChange={e => setEditFormData({...editFormData, role: e.target.value})}
                    >
                      <option value="SELLER">Vendedor</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  if (pendingAvatarUrlRef.current) {
                    URL.revokeObjectURL(pendingAvatarUrlRef.current)
                    pendingAvatarUrlRef.current = ''
                  }
                  setPendingAvatarFile(null)
                  setPendingAvatarPreview('')
                  setEditingMember(null)
                }}>Cancelar</Button>
                <Button type="submit" disabled={editSubmitting || uploadingImage}>
                  {editSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
