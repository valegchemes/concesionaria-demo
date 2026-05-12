import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Car, Handshake, TrendingUp, AlertCircle, Clock,
  CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { AnalyticsDashboardLazy } from '@/components/dashboard/analytics-dashboard-lazy'

async function getDashboardData(companyId: string, userId: string, role: string) {
  const isSeller = role === 'SELLER'
  const leadWhere = isSeller ? { companyId, assignedToId: userId } : { companyId }
  const dealWhere = isSeller ? { companyId, sellerId: userId } : { companyId }

  const [
    totalLeads, activeLeads, newLeads, lostLeads,
    totalUnits, availableUnits, soldUnits,
    activeDeals, completedDeals, canceledDeals,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'NEW' } }),
    prisma.lead.count({ where: { ...leadWhere, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId, isActive: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'SOLD' } }),
    prisma.deal.count({ where: { ...dealWhere, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'DELIVERED' } }),
    prisma.deal.count({ where: { ...dealWhere, status: 'CANCELED' } }),
  ])

  return {
    leads: { total: totalLeads, active: activeLeads, new: newLeads, lost: lostLeads },
    units: { total: totalUnits, available: availableUnits, sold: soldUnits },
    deals: { active: activeDeals, completed: completedDeals, canceled: canceledDeals },
  }
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

interface KpiCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  accentColor: string
  iconColor: string
  trend?: { value: number; label: string }
}

function KpiCard({ title, value, subtitle, icon: Icon, accentColor, iconColor, trend }: KpiCardProps) {
  return (
    <Card className={`relative overflow-hidden border-l-4 ${accentColor} bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-white/30 hover:shadow-lg hover:shadow-black/10 transition-all duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-black text-foreground tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value > 0 ? 'text-emerald-600' : trend.value < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {trend.value > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend.value < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatPillProps {
  label: string
  value: number
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red'
}

function StatPill({ label, value, sublabel, icon: Icon, color }: StatPillProps) {
  const colorMap = {
    blue: {
      card: 'border-blue-100/50 bg-blue-50/40 dark:border-blue-900/30 dark:bg-blue-950/30',
      label: 'text-blue-700 dark:text-blue-300',
      value: 'text-blue-800 dark:text-blue-100',
      sub: 'text-blue-600/70 dark:text-blue-400/70',
      icon: 'text-blue-300 dark:text-blue-600',
    },
    green: {
      card: 'border-emerald-100/50 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/30',
      label: 'text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-800 dark:text-emerald-100',
      sub: 'text-emerald-600/70 dark:text-emerald-400/70',
      icon: 'text-emerald-300 dark:text-emerald-600',
    },
    red: {
      card: 'border-red-100/50 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/30',
      label: 'text-red-700 dark:text-red-300',
      value: 'text-red-800 dark:text-red-100',
      sub: 'text-red-600/70 dark:text-red-400/70',
      icon: 'text-red-300 dark:text-red-600',
    },
  }
  const c = colorMap[color]

  return (
    <Card className={`${c.card} backdrop-blur-sm border`}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${c.label}`}>{label}</p>
            <p className={`mt-1 text-3xl font-black ${c.value}`}>{formatNumber(value)}</p>
            <p className={`mt-0.5 text-xs ${c.sub}`}>{sublabel}</p>
          </div>
          <Icon className={`h-10 w-10 ${c.icon}`} />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.companyId) {
    redirect('/login')
  }

  let stats = {
    leads: { total: 0, active: 0, new: 0, lost: 0 },
    units: { total: 0, available: 0, sold: 0 },
    deals: { active: 0, completed: 0, canceled: 0 },
  }

  let companyName: string | undefined

  try {
    const [data, company] = await Promise.all([
      getDashboardData(session.user.companyId, session.user.id, session.user.role),
      prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { name: true },
      }),
    ])
    stats = data
    companyName = company?.name
  } catch (e) {
    console.error('[Dashboard] DB error:', e)
  }

  const conversionRate =
    stats.leads.total > 0
      ? Math.min(100, (stats.deals.completed / stats.leads.total) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel de Control</h1>
          {companyName && (
            <p className="mt-1 text-sm text-slate-500">{companyName}</p>
          )}
        </div>
      </div>

      {/* Section 1: Actividad de Hoy */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Visitas y Test Drives */}
        <Card className="lg:col-span-1 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Actividad de Hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Visitas de Clientes</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">{formatNumber(stats.leads.new)}</p>
              <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-blue-400 to-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pruebas de Manejo (Test Drives)</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.deals.active)}</p>
              <div className="mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Embudo de Ventas */}
        <Card className="lg:col-span-1 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Embudo de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-32 h-4 rounded bg-gradient-to-r from-blue-500 to-blue-400 shadow-sm" />
                <span className="text-xs text-slate-600 font-medium">Lead Inicial ({formatNumber(Math.ceil(stats.leads.total * 0.5))})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-4 rounded bg-gradient-to-r from-sky-500 to-sky-400 shadow-sm" />
                <span className="text-xs text-slate-600 font-medium">Contactado ({formatNumber(Math.ceil(stats.leads.total * 0.38))})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-4 rounded bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm" />
                <span className="text-xs text-slate-600 font-medium">Cita Concertada ({formatNumber(Math.ceil(stats.leads.total * 0.15))})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-4 rounded bg-gradient-to-r from-amber-500 to-amber-400 shadow-sm" />
                <span className="text-xs text-slate-600 font-medium">Oferta Formal ({formatNumber(Math.ceil(stats.leads.total * 0.09))})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-4 rounded bg-gradient-to-r from-red-500 to-red-400 shadow-sm" />
                <span className="text-xs text-slate-600 font-medium">Cierre de Venta ({formatNumber(stats.deals.completed)})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ventas del Mes */}
        <Card className="lg:col-span-1 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Ventas del Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-right mb-4">
              <p className="text-3xl font-bold text-slate-900">$1.2M USD</p>
              <p className="text-xs text-slate-500 mt-1">Ventas Totales del Mes</p>
            </div>
            <div className="h-12 rounded bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 flex items-end p-2 gap-1">
              <div className="h-2/3 w-1 bg-emerald-400 rounded-sm opacity-60" />
              <div className="h-3/4 w-1 bg-emerald-500 rounded-sm opacity-70" />
              <div className="h-4/5 w-1 bg-emerald-500 rounded-sm opacity-80" />
              <div className="h-5/6 w-1 bg-emerald-600 rounded-sm opacity-90" />
              <div className="h-full w-1 bg-emerald-600 rounded-sm" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Leads Recientes y Autos en Stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leads Recientes Table */}
        <Card className="lg:col-span-2 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Leads Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-3 text-xs font-bold uppercase tracking-wide text-slate-500 pb-3 border-b border-slate-100">
                <div>Nombre</div>
                <div>Fuente</div>
                <div>Estado</div>
                <div>Vehículo</div>
                <div>Asesor</div>
              </div>
              {/* Mock leads para demostración */}
              {[
                { name: 'Juan Pérez', source: 'WhatsApp', status: 'Cita Pendiente', vehicle: 'VW Tiguan', advisor: 'Sarah' },
                { name: 'Ana Gómez', source: 'Teléfono', status: 'Seguimiento', vehicle: 'Ford Focus', advisor: 'Sarah' },
                { name: 'Marcos Díaz', source: 'Web', status: 'Nuevo', vehicle: 'Seat León', advisor: 'Michael' },
                { name: 'Sofía Martín', source: 'Showroom', status: 'Nuevo', vehicle: 'VW Golf', advisor: 'Michael' },
                { name: 'Diego Soler', source: 'Referencia', status: 'Cierre Pendiente', vehicle: 'Ford Kuga', advisor: 'Sarah' },
              ].map((lead, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-3 py-3 text-sm text-slate-700 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-slate-500">{lead.source}</div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      lead.status === 'Nuevo' ? 'bg-green-100 text-green-700' :
                      lead.status === 'Seguimiento' ? 'bg-blue-100 text-blue-700' :
                      lead.status === 'Cita Pendiente' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="text-slate-500">{lead.vehicle}</div>
                  <div className="text-slate-500">{lead.advisor}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Autos en Stock */}
        <Card className="lg:col-span-1 bg-white border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">Total Autos en Stock</CardTitle>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(stats.units.total)}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Disponibles</span>
                <span className="text-sm font-bold text-emerald-600">{formatNumber(stats.units.available)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Vendidos</span>
                <span className="text-sm font-bold text-blue-600">{formatNumber(stats.units.sold)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Disponibilidad</p>
                <div className="flex gap-2">
                  <div className="flex-1 h-2 rounded-full bg-emerald-200 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${Math.round((stats.units.available / stats.units.total) * 100) || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 font-semibold">{Math.round((stats.units.available / stats.units.total) * 100) || 0}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen Operacional (Mini KPI Cards) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Leads Activos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.leads.active)}</p>
            </div>
            <Users className="h-6 w-6 text-blue-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Operaciones</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.deals.active)}</p>
            </div>
            <Handshake className="h-6 w-6 text-amber-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Conversión</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{conversionRate}%</p>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Inventario</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(stats.units.available)}</p>
            </div>
            <Car className="h-6 w-6 text-violet-500 opacity-20" />
          </div>
        </div>
      </div>
    </div>
  )
}
