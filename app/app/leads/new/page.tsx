'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const sources = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK_MARKETPLACE', label: 'Facebook Marketplace' },
  { value: 'REFERRAL', label: 'Referido' },
  { value: 'WALK_IN', label: 'Presencial' },
  { value: 'PHONE', label: 'Teléfono' },
  { value: 'WEBSITE', label: 'Web' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'OLX', label: 'OLX' },
  { value: 'AUTOSUSADOS', label: 'AutosUsados' },
  { value: 'OTHER', label: 'Otro' },
]

const statuses = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'VISIT_SCHEDULED', label: 'Visita Agendada' },
  { value: 'OFFER', label: 'Oferta' },
  { value: 'RESERVED', label: 'Reservado' },
  { value: 'SOLD', label: 'Vendido' },
  { value: 'LOST', label: 'Perdido' },
]

interface User {
  id: string
  name: string
}

interface Unit {
  id: string
  title: string
}

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'OTHER',
    status: 'NEW',
    notes: '',
    assignedToId: '',
    interestedUnitId: '',
  })

  useEffect(() => {
    fetchUsers()
    fetchUnits()
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  async function fetchUnits() {
    try {
      const res = await fetch('/api/units?status=AVAILABLE')
      if (res.ok) {
        const data = await res.json()
        setUnits(data)
      }
    } catch (error) {
      console.error('Error fetching units:', error)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        assignedToId: formData.assignedToId || undefined,
        interestedUnitId: formData.interestedUnitId || undefined,
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/app/leads')
      } else {
        const error = await res.json()
        alert('Error: ' + JSON.stringify(error))
      }
    } catch (error) {
      console.error('Error creating lead:', error)
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuevo Lead</h1>

      <form onSubmit={onSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+54 11 1234-5678"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Origen y Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Origen</Label>
                  <select
                    id="source"
                    value={formData.source}
                    onChange={(e) => updateField('source', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border"
                  >
                    {sources.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado inicial</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border"
                  >
                    {statuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asignación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assignedToId">Asignar a vendedor</Label>
                <select
                  id="assignedToId"
                  value={formData.assignedToId}
                  onChange={(e) => updateField('assignedToId', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border"
                >
                  <option value="">Sin asignar</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestedUnitId">Unidad de interés</Label>
                <select
                  id="interestedUnitId"
                  value={formData.interestedUnitId}
                  onChange={(e) => updateField('interestedUnitId', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border"
                >
                  <option value="">Sin unidad específica</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border"
                  placeholder="Información adicional del lead..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Lead'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
