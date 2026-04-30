import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.findFirst({ where: { name: 'Banigale' } })
  if (!company) return
  
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const end = new Date()

  const deals = await prisma.deal.findMany({
    where: { companyId: company.id, status: 'DELIVERED', updatedAt: { gte: start, lte: end } },
    include: {
      unit: true,
      closingCosts: true
    }
  })
  
  const companyExpenses = await prisma.companyExpense.findMany({
      where: { companyId: company.id, date: { gte: start, lte: end }, isActive: true }
  })
  
  const unitCosts = await prisma.unitCostItem.findMany({
      where: { unit: { companyId: company.id }, date: { gte: start, lte: end } }
  })
  
  console.log('--- DEALS ---')
  for (const d of deals) {
    console.log(`Deal ${d.id}: Date=${d.updatedAt.toISOString()}, Sale=${d.finalPrice} ${d.finalPriceCurrency}, UnitCost=${d.unit?.acquisitionCostArs} ARS / ${d.unit?.acquisitionCostUsd} USD`)
    for (const cc of d.closingCosts) {
      console.log(`  - Closing Cost: ${cc.amountArs} ARS / ${cc.amountUsd} USD`)
    }
  }
  
  console.log('--- COMPANY EXPENSES ---')
  for (const exp of companyExpenses) {
      console.log(`Expense ${exp.id}: Date=${exp.date.toISOString()}, Amount=${exp.amountArs} ARS / ${exp.amountUsd} USD`)
  }
  
  console.log('--- UNIT COSTS ---')
  for (const uc of unitCosts) {
      console.log(`Unit Cost ${uc.id}: Date=${uc.date.toISOString()}, Amount=${uc.amountArs} ARS / ${uc.amountUsd} USD`)
  }
}
main().then(() => prisma.$disconnect())
