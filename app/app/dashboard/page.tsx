import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Car, Handshake, TrendingUp, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { AnalyticsDashboardLazy } from '@/components/dashboard/analytics-dashboard-lazy'

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
      where: { companyId, status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] } },
    }),
    prisma.lead.count({ where: { companyId, status: 'NEW' } }),
    prisma.lead.count({ where: { companyId, status: 'LOST' } }),
    prisma.unit.count({ where: { companyId, isActive: true } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'AVAILABLE' } }),
    prisma.unit.count({ where: { companyId, isActive: true, status: 'SOLD' } }),
    prisma.deal.count({
      where: { companyId, status: { in: ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT'] } },
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        {companyName && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-300">{companyName}</p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
          Resumen Operacional
        </h2>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Tasa de Conversion</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">leads → ventas cerradas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-blue-100 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/40">
            <CardContent className="pb-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">En Curso</p>
                  <p className="mt-1 text-3xl font-black text-blue-800 dark:text-blue-100">{formatNumber(stats.deals.active)}</p>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">negociaciones activas</p>
                </div>
                <Clock className="h-10 w-10 text-blue-300 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-green-50/40 dark:border-green-900/50 dark:bg-green-950/40">
            <CardContent className="pb-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-300">Completadas</p>
                  <p className="mt-1 text-3xl font-black text-green-800 dark:text-green-100">{formatNumber(stats.deals.completed)}</p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">operaciones entregadas</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-300 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/40">
            <CardContent className="pb-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300">Canceladas</p>
                  <p className="mt-1 text-3xl font-black text-red-800 dark:text-red-100">{formatNumber(stats.deals.canceled)}</p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">operaciones canceladas</p>
                </div>
                <XCircle className="h-10 w-10 text-red-300 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t pt-2 dark:border-slate-800">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
          Analiticas de Ventas
        </h2>
        {stats.deals.completed > 0 ? (
          <AnalyticsDashboardLazy
            companyId={session.user.companyId}
            companyName={companyName}
            hideHeader
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-gray-400 dark:text-gray-300">
              <Handshake className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium text-gray-500 dark:text-gray-200">Sin ventas completadas aun</p>
              <p className="mt-1 text-sm">
                Los graficos de ventas, ganancias y costos apareceran cuando marques tu primera operacion como <strong>Entregada</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
