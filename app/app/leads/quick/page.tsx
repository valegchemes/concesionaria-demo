'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Phone, Search } from 'lucide-react'

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

interface ParsedLead {
  name: string
  phone: string
  email: string
  rawText: string
}

function parseLeadText(text: string): ParsedLead {
  const lines = text.split('\n').filter(l => l.trim())
  
  // Phone patterns
  const phonePatterns = [
    /(?:\+54)?\s*(?:11|[2368]\d{2})\s*\d{4}[\s-]?\d{4}/,
    /(?:\+54)?\s*9\s*(?:11|[2368]\d{2})\s*\d{4}[\s-]?\d{4}/,
    /\d{4}[\s-]?\d{4}/,
  ]
  
  let phone = ''
  for (const line of lines) {
    for (const pattern of phonePatterns) {
      const match = line.match(pattern)
      if (match) {
        phone = match[0].replace(/\s/g, '')
        break
      }
    }
    if (phone) break
  }
  
  // Email pattern
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
  const email = emailMatch ? emailMatch[0] : ''
  
  // Name - usually first non-empty line that doesn't look like phone/email
  let name = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && 
        !trimmed.match(/^\d/) && 
        !trimmed.includes('@') &&
        !trimmed.toLowerCase().includes('hola') &&
        !trimmed.toLowerCase().includes('buenos') &&
        trimmed.length < 50) {
      name = trimmed.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim()
      break
    }
  }
  
  return { name, phone, email, rawText: text }
}

export default function QuickLeadPage() {
  const router = useRouter()
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedLead | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'OTHER',
    notes: '',
  })

  function handleParse() {
    const result = parseLeadText(rawText)
    setParsed(result)
    setFormData(prev => ({
      ...prev,
      name: result.name,
      phone: result.phone,
      email: result.email,
      notes: result.rawText,
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Lead Rápido</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pegar texto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Pegá aquí el texto desde Instagram, Facebook, WhatsApp, etc. 
              El sistema intentará detectar nombre, teléfono y email automáticamente.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ejemplo:
Juan Pérez
Hola, me interesa el auto
+54 11 1234-5678"
              className="w-full min-h-[150px] px-3 py-2 rounded-md border"
            />
            <Button onClick={handleParse} disabled={!rawText.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Detectar datos
            </Button>
          </CardContent>
        </Card>

        {(parsed || formData.name || formData.phone) && (
          <form onSubmit={onSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Datos detectados / Editar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {parsed && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Detectado:</strong> {parsed.name ? `Nombre: "${parsed.name}"` : 'Sin nombre'} 
                      {parsed.phone && ` • Teléfono: "${parsed.phone}"`}
                      {parsed.email && ` • Email: "${parsed.email}"`}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="pl-9"
                      placeholder="+54 11 1234-5678"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Origen</Label>
                  <select
                    id="source"
                    value={formData.source}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border"
                  >
                    {sources.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas (texto original)</Label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full min-h-[100px] px-3 py-2 rounded-md border"
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar Lead'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </div>
  )
}
