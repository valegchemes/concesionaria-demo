import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.company.findMany()
  console.log('Companies:', companies.map(c => c.name))
  
  for (const c of companies) {
    const deals = await prisma.deal.findMany({
      where: { companyId: c.id, status: 'DELIVERED' }
    })
    if (deals.length > 0) {
      console.log(`Company ${c.name} has ${deals.length} delivered deals.`)
      let totalRevenueArs = 0
      for (const d of deals) {
        let rev = Number(d.finalPrice)
        if (d.finalPriceCurrency === 'USD') {
            rev = rev * Number(d.exchangeRate || 1000)
        }
        totalRevenueArs += rev
        console.log(`- Deal ${d.id}: finalPrice=${d.finalPrice} ${d.finalPriceCurrency}, exc=${d.exchangeRate}, Date=${d.updatedAt.toISOString()}`)
      }
      console.log(`Total Revenue ARS calculated manually: ${totalRevenueArs}`)
    }
  }
}
main().then(() => prisma.$disconnect())
