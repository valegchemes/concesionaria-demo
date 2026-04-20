import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { Users, Car, Handshake, TrendingUp } from 'lucide-react'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'

async function getDashboardData(companyId: string) {
  const [
    totalLeads,
    activeLeads,
    totalUnits,
    availableUnits,
    activeDeals,
    recentLeads,
    recentUnits,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({ 
      where: { 
        companyId,
        status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER'] }
      } 
    }),
    prisma.unit.count({ where: { companyId } }),
    prisma.unit.count({ where: { companyId, status: 'AVAILABLE' } }),
    prisma.deal.count({ 
      where: { 
        companyId,
        status: { in: ['NEGOTIATION', 'RESERVED'] }
      } 
    }),
    prisma.lead.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { assignedTo: true, interestedUnit: true },
    }),
    prisma.unit.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    totalLeads,
    activeLeads,
    totalUnits,
    availableUnits,
    activeDeals,
    recentLeads,
    recentUnits,
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.companyId) {
    redirect('/login')
  }

  let data
  try {
    data = await getDashboardData(session.user.companyId)
  } catch (error) {
    // Demo data cuando no hay DB
    data = {
      totalLeads: 3,
      activeLeads: 2,
      totalUnits: 5,
      availableUnits: 3,
      activeDeals: 0,
      recentLeads: [],
      recentUnits: [],
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Activos</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeLeads}</div>
            <p className="text-xs text-muted-foreground">de {data.totalLeads} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unidades Disponibles</CardTitle>
            <Car className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.availableUnits}</div>
            <p className="text-xs text-muted-foreground">de {data.totalUnits} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operaciones en curso</CardTitle>
            <Handshake className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeDeals}</div>
            <p className="text-xs text-muted-foreground">Negociaciones activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">Próximamente</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {lead.phone} • {lead.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {lead.status}
                    </span>
                    {lead.assignedTo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Asignado: {lead.assignedTo.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unidades recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentUnits.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{unit.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {unit.type} • {unit.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {unit.priceArs ? formatPrice(Number(unit.priceArs), 'ARS') : '-'}
                    </p>
                    {unit.priceUsd && (
                      <p className="text-xs text-muted-foreground">
                        USD {unit.priceUsd.toString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
