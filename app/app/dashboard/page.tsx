import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'

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

  // Get company name for display
  let companyName: string | undefined
  try {
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { name: true },
    })
    companyName = company?.name
  } catch {
    // ignore
  }

  return (
    <AnalyticsDashboard
      companyId={session.user.companyId}
      companyName={companyName}
    />
  )
}
