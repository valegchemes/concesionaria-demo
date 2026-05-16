
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'valegchemes@gmail.com'
  const user = await prisma.user.findFirst({
    where: { email },
    include: { company: true }
  })

  if (!user) {
    console.error('User not found')
    return
  }

  const leads = await prisma.lead.findMany({
    where: { companyId: user.companyId },
    include: {
      deals: {
        include: {
          unit: true,
          seller: true,
          payments: true
        }
      },
      tasks: true
    }
  })

  console.log(`Found ${leads.length} leads for company ${user.company.name}`)
  leads.forEach(l => {
    console.log(`Lead: ${l.name} - Deals: ${l.deals.length} - Tasks: ${l.tasks.length}`)
    l.deals.forEach(d => {
      console.log(`  Deal: ${d.unit.title} - Status: ${d.status} - Payments: ${d.payments.length}`)
    })
  })
}

main().finally(() => prisma.$disconnect())
