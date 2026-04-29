const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const expenses = await prisma.companyExpense.findMany({
    orderBy: { date: 'desc' },
    select: { id: true, category: true, amountArs: true, amountUsd: true, date: true, isActive: true, companyId: true }
  });
  
  console.log('Total expenses in DB:', expenses.length);
  expenses.forEach(e => {
    console.log(`  [${e.isActive ? 'ACTIVE' : 'INACTIVE'}] ${e.category} | ARS: ${e.amountArs} | USD: ${e.amountUsd} | date: ${e.date.toISOString()} | companyId: ${e.companyId}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
