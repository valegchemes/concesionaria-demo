'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, User, Globe, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string | null
  companyId: string
  companyName: string
  companySlug: string
  whatsappCentral?: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [me, setMe] = useState<CurrentUser | null>(null)
  const isCompanyAdmin = me?.role === 'ADMIN'

  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyCuit, setCompanyCuit] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [whatsappCentral, setWhatsappCentral] = useState('')
  const [currencyPref, setCurrencyPref] = useState('BOTH')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [meRes, companyRes] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }),
          fetch('/api/settings/company', { cache: 'no-store' }),
        ])

        if (meRes.ok) {
          const meData = await meRes.json()
          setMe(meData)
          setUserName(meData.name || '')
          setUserEmail(meData.email || '')
          setAvatarUrl(meData.avatarUrl || '')
        }

        if (companyRes.ok) {
          const companyData = await companyRes.json()
          setCompanyName(companyData.name || '')
          setCompanyPhone(companyData.phone || '')
          setCompanyEmail(companyData.email || '')
          setCompanyCuit(companyData.cuit || '')
          setCompanyAddress(companyData.address || '')
          setWhatsappCentral(companyData.whatsappCentral || '')
          setCurrencyPref(companyData.currencyPreference || 'BOTH')
          setLogoUrl(companyData.logoUrl || '')
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      }
    }

    fetchSettings()
  }, [])

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let finalLogoUrl = logoUrl

      if (logoFile) {
        const { upload } = await import('@vercel/blob/client')
        const newBlob = await upload(`logos/${logoFile.name}`, logoFile, {
          access: 'public',
          handleUploadUrl: '/api/blob',
        })
        finalLogoUrl = newBlob.url
      }

      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          phone: companyPhone,
          email: companyEmail,
          cuit: companyCuit,
          address: companyAddress,
          whatsappCentral,
          currencyPreference: currencyPref,
          logoUrl: finalLogoUrl,
        }),
      })

      if (res.ok) {
        setLogoUrl(finalLogoUrl)
        alert('Configuracion de empresa guardada con exito')
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        const errMsg = Array.isArray(data?.error)
          ? data.error.map((e: any) => e.message || e.path?.join('.')).join(', ')
          : data?.error
        alert(errMsg || 'No se pudo guardar la configuracion de empresa')
      }
    } catch {
      alert('Error guardando empresa')
    } finally {
      setLoading(false)
    }
  }

  async function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let finalAvatarUrl = avatarUrl

      if (avatarFile) {
        const { upload } = await import('@vercel/blob/client')
        const newBlob = await upload(`avatars/${avatarFile.name}`, avatarFile, {
          access: 'public',
          handleUploadUrl: '/api/blob',
        })
        finalAvatarUrl = newBlob.url
      }

      const isChangingCredentials = Boolean(password) || userEmail !== me?.email

      const res = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          avatarUrl: finalAvatarUrl,
          ...(password ? { password } : {}),
          ...(isChangingCredentials && currentPassword ? { currentPassword } : {}),
        }),
      })

      if (res.ok) {
        setPassword('')
        setCurrentPassword('')
        setAvatarUrl(finalAvatarUrl)
        setMe((prev) =>
          prev
            ? {
                ...prev,
                name: userName,
                email: userEmail,
              }
            : prev
        )
        alert('Perfil guardado con exito')
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        const errMsg = Array.isArray(data?.error)
          ? data.error.map((e: any) => e.message || e.path?.join('.')).join(', ')
          : data?.error
        alert(errMsg || 'No se pudo actualizar el perfil')
      }
    } catch {
      alert('Error guardando usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground">
          Gestiona los ajustes de tu concesionaria y tu perfil de usuario.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <CardTitle>Concesionaria</CardTitle>
            </div>
            <CardDescription>Ajustes publicos e informacion de contacto.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Logo de la Empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-slate-100">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0]
                        setLogoFile(file)
                        setLogoUrl(URL.createObjectURL(file))
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
                <Label htmlFor="companyPhone">Telefono Fijo / Principal</Label>
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
                <Label htmlFor="companyCuit">CUIT / DNI Comercial</Label>
                <Input
                  id="companyCuit"
                  placeholder="Ej: 30-12345678-9"
                  value={companyCuit}
                  onChange={e => setCompanyCuit(e.target.value)}
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="companyAddress">Domicilio Comercial (Aparece en Documentos)</Label>
                <Input
                  id="companyAddress"
                  placeholder="Ej: Av. del Libertador 1234, CABA"
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
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
                <Label htmlFor="currencyPref">Moneda Predefinida (Catalogo)</Label>
                <select
                  id="currencyPref"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={currencyPref}
                  onChange={e => setCurrencyPref(e.target.value)}
                >
                  <option value="BOTH">Mostrar ARS y USD</option>
                  <option value="ARS">Solo ARS</option>
                  <option value="USD">Solo USD</option>
                </select>
              </div>

              <Button type="submit" disabled={loading || !isCompanyAdmin} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Empresa
              </Button>

              {!isCompanyAdmin && (
                <p className="text-sm text-muted-foreground">
                  Solo los administradores pueden cambiar los datos de la concesionaria.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                <CardTitle>Usuario Actual</CardTitle>
              </div>
              <CardDescription>Credenciales de tu cuenta ({me?.role || '...' }).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tu Foto de Perfil</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-slate-100">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0]
                          setAvatarFile(file)
                          setAvatarUrl(URL.createObjectURL(file))
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
                  <Label htmlFor="password">Cambiar Contrasena</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Dejar en blanco para mantener actual"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Contrasena Actual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Obligatoria para cambiar email o contrasena"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
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
                  <Label>Catalogo Publico Visible en:</Label>
                  <div className="mt-1 break-all rounded-md border bg-slate-50 p-3 font-mono text-sm">
                    https://concesionaria-demo-three.vercel.app/u/{me?.companySlug || '...'}
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Para mapear un dominio personalizado como &quot;autos-juan.com&quot; contactate con soporte.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
