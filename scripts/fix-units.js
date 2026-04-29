const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all units that have at least one DELIVERED deal
  const units = await prisma.unit.findMany({
    include: {
      deals: {
        where: { status: 'DELIVERED' }
      }
    }
  });

  const mismatched = units.filter(u => u.deals.length > 0 && u.status !== 'SOLD');
  
  console.log('Mismatched units:', mismatched.length);
  
  for (const u of mismatched) {
    await prisma.unit.update({
      where: { id: u.id },
      data: { status: 'SOLD', isActive: false }
    });
    console.log('Fixed unit:', u.title);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
