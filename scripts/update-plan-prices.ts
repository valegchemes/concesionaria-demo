import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PRICE_MAP: Record<string, number> = {
  'Plan Básico': 1000,
  'Plan Medio':  200000,
  'Plan Pro':    260000,
}

async function main() {
  const plans = await prisma.saasPlan.findMany({
    select: { id: true, name: true, price: true },
  })

  console.log('Planes actuales:')
  for (const plan of plans) {
    console.log(`  ${plan.name}: ${plan.price}`)
  }

  for (const plan of plans) {
    const newPrice = PRICE_MAP[plan.name]
    if (newPrice !== undefined) {
      await prisma.saasPlan.update({
        where: { id: plan.id },
        data: { price: newPrice, currency: 'ARS' },
      })
      console.log(`✓ Actualizado ${plan.name}: ${plan.price} → ${newPrice}`)
    } else {
      console.log(`  Omitido: "${plan.name}" (no está en PRICE_MAP)`)
    }
  }

  console.log('\nPlanes actualizados exitosamente.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
