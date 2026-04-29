const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const units = await prisma.unit.findMany({
    where: { title: { in: ['toyota corolla 2020', 'bayliner 302 2022', 'yaris gr 2024'] } },
    select: { title: true, status: true, isActive: true }
  });
  console.log(units);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
