import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = await prisma.saasPlan.findMany({
    select: { id: true, name: true, documentsEnabled: true },
  })

  console.log('Planes encontrados:', plans.map(p => p.name))

  for (const plan of plans) {
    const isPro = plan.name.toLowerCase().includes('pro')
    await prisma.saasPlan.update({
      where: { id: plan.id },
      data: { documentsEnabled: isPro },
    })
    console.log(`✓ ${plan.name}: documentsEnabled = ${isPro}`)
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
