'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Plus, Search, Phone, Mail, User, Car, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: string
  createdAt: string
  assignedTo: { name: string } | null
  interestedUnit: { title: string } | null
  tasks: { dueDate: string; isCompleted: boolean }[]
  _count: { activities: number; deals: number }
}

const sourceLabels: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK_MARKETPLACE: 'Facebook',
  REFERRAL: 'Referido',
  WALK_IN: 'Presencial',
  PHONE: 'Teléfono',
  WEBSITE: 'Web',
  WHATSAPP: 'WhatsApp',
  OLX: 'OLX',
  AUTOSUSADOS: 'AutosUsados',
  OTHER: 'Otro',
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  VISIT_SCHEDULED: 'bg-purple-100 text-purple-800',
  OFFER: 'bg-orange-100 text-orange-800',
  RESERVED: 'bg-pink-100 text-pink-800',
  SOLD: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  VISIT_SCHEDULED: 'Visita Agendada',
  OFFER: 'Oferta',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
  LOST: 'Perdido',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      const res = await fetch('/api/leads', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        // The API returns a standardized object { success: true, data: [...], ... }
        setLeads(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLeads = Array.isArray(leads) 
    ? leads.filter(lead =>
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search)
      )
    : []

  function hasOverdueTask(lead: Lead): boolean {
    if (lead.status === 'LOST' || lead.status === 'SOLD') return false
    const tasks = lead.tasks || []
    if (tasks.length === 0 && 
        ['CONTACTED', 'VISIT_SCHEDULED', 'OFFER'].includes(lead.status)) {
      return true
    }
    if (tasks[0] && new Date(tasks[0].dueDate) < new Date()) {
      return true
    }
    return false
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión de Leads</h1>
        <div className="flex gap-2">
          <Link href="/app/leads/quick">
            <Button variant="outline">Lead Rápido</Button>
          </Link>
          <Link href="/app/leads/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Lead
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className={hasOverdueTask(lead) ? 'border-red-300' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{lead.name}</h3>
                    {hasOverdueTask(lead) && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {lead.phone}
                    </span>
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {lead.email}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                      {statusLabels[lead.status]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sourceLabels[lead.source]}
                    </span>
                    {lead.assignedTo && (
                      <span className="text-xs flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {lead.assignedTo.name}
                      </span>
                    )}
                    {lead.interestedUnit && (
                      <span className="text-xs flex items-center gap-1">
                        <Car className="h-3 w-3" />
                        {lead.interestedUnit.title}
                      </span>
                    )}
                  </div>

                  {lead.tasks?.[0] && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${
                      new Date(lead.tasks[0].dueDate) < new Date() ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      <CheckCircle2 className="h-3 w-3" />
                      Próxima tarea: {formatDate(lead.tasks[0].dueDate)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Link href={`/app/leads/${lead.id}`}>
                    <Button size="sm">Ver</Button>
                  </Link>
                  <div className="text-xs text-gray-500 text-center">
                    {lead._count.activities} act.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
