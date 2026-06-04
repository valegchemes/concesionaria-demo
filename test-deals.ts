import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const deals = await prisma.deal.findMany({
    where: {
      status: 'DELIVERED',
    },
    select: {
      id: true,
      closedAt: true,
      updatedAt: true,
      companyId: true,
    },
    take: 10
  })
  console.log(deals)
}
main()
