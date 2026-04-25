import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Car, Handshake, TrendingUp, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'

async function getDashboardData(companyId: string) {
  const [
    totalLeads,
    activeLeads,
    newLeads,
    lostLeads,
    totalUnits,
    availableUnits,
    soldUnits,
    activeDeals,
    completedDeals,
    canceledDeals,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({
      where: { companyId, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } }
    }),
    prisma.lead.count({ where: { companyId, status: 'NEW' } }),
    prisma.lead.count({ where: { companyId, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId } }),
    prisma.unit.count({ where: { companyId, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, status: 'SOLD' } }),
    prisma.deal.count({
      where: { companyId, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } }
    }),
    prisma.deal.count({ where: { companyId, status: 'DELIVERED' } }),
    prisma.deal.count({ where: { companyId, status: 'CANCELED' } }),
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
      getDashboardData(session.user.companyId),
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
      ? ((stats.deals.completed / stats.leads.total) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {companyName && (
          <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>
        )}
      </div>

      {/* KPIs operacionales — siempre visibles */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Resumen Operacional
        </h2>

        {/* Leads */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Activos</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.leads.active)}</div>
              <p className="text-xs text-muted-foreground">de {formatNumber(stats.leads.total)} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Nuevos</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.leads.new)}</div>
              <p className="text-xs text-muted-foreground">sin contactar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unidades Disponibles</CardTitle>
              <Car className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.units.available)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats.deals.completed)} vendidas · {formatNumber(stats.units.total)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                leads → ventas cerradas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Operaciones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">En Curso</p>
                  <p className="text-3xl font-black text-blue-800 mt-1">{formatNumber(stats.deals.active)}</p>
                  <p className="text-xs text-blue-600 mt-1">negociaciones activas</p>
                </div>
                <Clock className="h-10 w-10 text-blue-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-green-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Completadas</p>
                  <p className="text-3xl font-black text-green-800 mt-1">{formatNumber(stats.deals.completed)}</p>
                  <p className="text-xs text-green-600 mt-1">operaciones entregadas</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-red-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Canceladas</p>
                  <p className="text-3xl font-black text-red-800 mt-1">{formatNumber(stats.deals.canceled)}</p>
                  <p className="text-xs text-red-600 mt-1">operaciones canceladas</p>
                </div>
                <XCircle className="h-10 w-10 text-red-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Divisor */}
      <div className="border-t pt-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Analíticas de Ventas
        </h2>
        {stats.deals.completed > 0 ? (
          <AnalyticsDashboard
            companyId={session.user.companyId}
            companyName={companyName}
            hideHeader
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              <Handshake className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Sin ventas completadas aún</p>
              <p className="text-sm mt-1">
                Los gráficos de ventas, ganancias y costos aparecerán cuando marques tu primera operación como <strong>Entregada</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
