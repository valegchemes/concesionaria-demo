import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const deals = await prisma.deal.findMany({
    where: { status: 'DELIVERED' },
    select: { id: true, updatedAt: true, companyId: true, sellerId: true }
  })
  console.log("All deals:", deals.map(d => d.updatedAt.toISOString()))
  
  // Test the date logic
  const date = "2026-04-29T00:00:00.000Z" // Use a date from my local DB
  const selectedDate = new Date(date)
  const year = selectedDate.getUTCFullYear()
  const month = selectedDate.getUTCMonth()
  const day = selectedDate.getUTCDate()

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999))
  
  console.log("Start:", start.toISOString())
  console.log("End:", end.toISOString())
  
  const filtered = await prisma.deal.findMany({
    where: {
      status: 'DELIVERED',
      updatedAt: { gte: start, lte: end }
    }
  })
  console.log("Filtered count:", filtered.length)
}
test()
