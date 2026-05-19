import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = await prisma.saasPlan.findMany({
    select: { id: true, name: true, auditEnabled: true },
  })

  console.log('Planes encontrados:', plans.map(p => p.name))

  for (const plan of plans) {
    const isProOrMedio = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('medio')
    await prisma.saasPlan.update({
      where: { id: plan.id },
      data: { auditEnabled: isProOrMedio },
    })
    console.log(`✓ ${plan.name}: auditEnabled = ${isProOrMedio}`)
  }

  console.log('\nListo.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
