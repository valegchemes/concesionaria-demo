'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, User, Phone, Globe, DollarSign, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  
  // States for Company Settings
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [whatsappCentral, setWhatsappCentral] = useState('')
  const [currencyPref, setCurrencyPref] = useState('BOTH')
  const [logoUrl, setLogoUrl] = useState('')

  // States for User Settings
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Load initial data
  useEffect(() => {
    async function fetchSettings() {
      try {
        setUserName(session?.user?.name || '')
        setUserEmail(session?.user?.email || '')
        
        // Fetch company data
        if (session?.user?.companyId) {
          const res = await fetch('/api/settings/company')
          if (res.ok) {
            const data = await res.json()
            setCompanyName(data.name || '')
            setCompanyPhone(data.phone || '')
            setCompanyEmail(data.email || '')
            setWhatsappCentral(data.whatsappCentral || '')
            setCurrencyPref(data.currencyPreference || 'BOTH')
            setLogoUrl(data.logoUrl || '')
          } else {
            // Fallback to session if API fails
            setCompanyName(session?.user?.companyName || '')
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      }
    }
    if (session?.user) {
      fetchSettings()
    }
  }, [session])

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          phone: companyPhone,
          email: companyEmail,
          whatsappCentral,
          currencyPreference: currencyPref,
          logoUrl
        })
      })
      if (res.ok) {
        alert('Configuración de empresa guardada con éxito')
        await update() // Refresh session
      }
    } catch (error) {
      alert('Error guardando empresa')
    } finally {
      setLoading(false)
    }
  }

  async function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          avatarUrl,
          ...(password ? { password } : {})
        })
      })
      if (res.ok) {
        alert('Perfil guardado con éxito')
        setPassword('')
        await update() // Refresh session
      }
    } catch (error) {
      alert('Error guardando usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Gestiona los ajustes de tu concesionaria y tu perfil de usuario.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Settings */}
        <Card className="col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <CardTitle>Concesionaria</CardTitle>
            </div>
            <CardDescription>Ajustes públicos e información de contacto.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Logo de la Empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center border">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader()
                        reader.onloadend = () => setLogoUrl(reader.result as string)
                        reader.readAsDataURL(e.target.files[0])
                      }
                    }} 
                    className="flex-1" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre Visible</Label>
                <Input 
                  id="companyName" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Teléfono Fijo / Principal</Label>
                <Input 
                  id="companyPhone" 
                  placeholder="+54 9 11 1234-5678"
                  value={companyPhone} 
                  onChange={e => setCompanyPhone(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappCentral">WhatsApp Central (Ventas)</Label>
                <Input 
                  id="whatsappCentral" 
                  placeholder="5491112345678 (Sin '+')"
                  value={whatsappCentral} 
                  onChange={e => setWhatsappCentral(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email Comercial</Label>
                <Input 
                  id="companyEmail" 
                  type="email" 
                  value={companyEmail} 
                  onChange={e => setCompanyEmail(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currencyPref">Moneda Predefinida (Catálogo)</Label>
                <select 
                  id="currencyPref" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={currencyPref}
                  onChange={e => setCurrencyPref(e.target.value)}
                >
                  <option value="BOTH">Mostrar ARS y USD</option>
                  <option value="ARS">Sólo ARS</option>
                  <option value="USD">Sólo USD</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Empresa
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Settings */}
        <div className="space-y-6 col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                <CardTitle>Usuario Actual</CardTitle>
              </div>
              <CardDescription>Credenciales de tu cuenta ({session?.user?.role}).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tu Foto de Perfil</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-slate-100 rounded-full overflow-hidden flex items-center justify-center border">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const reader = new FileReader()
                          reader.onloadend = () => setAvatarUrl(reader.result as string)
                          reader.readAsDataURL(e.target.files[0])
                        }
                      }} 
                      className="flex-1" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userName">Tu Nombre</Label>
                  <Input 
                    id="userName" 
                    value={userName} 
                    onChange={e => setUserName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Tu Email de Acceso</Label>
                  <Input 
                    id="userEmail" 
                    type="email" 
                    value={userEmail} 
                    onChange={e => setUserEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Cambiar Contraseña</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Dejar en blanco para mantener actual"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                  />
                </div>
                <Button type="submit" disabled={loading} variant="outline" className="w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Actualizar Perfil
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-500" />
                <CardTitle>Dominio y Visibilidad</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Catálogo Público Visible en:</Label>
                  <div className="mt-1 p-3 bg-slate-50 border rounded-md font-mono text-sm break-all">
                    https://concesionaria-demo-three.vercel.app/u/{session?.user?.companySlug || '...'}
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Para mapear un dominio personalizado como "autos-juan.com" contáctate con soporte.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
