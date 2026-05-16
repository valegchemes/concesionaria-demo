import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Mercado Pago plans...')

  const plans = [
    {
      name: 'Plan Básico',
      description: 'Ideal para pequeñas concesionarias. Hasta 5 usuarios y 50 vehículos en inventario.',
      stripeProductId: 'mp_prod_basico',
      stripePriceId: 'mp_plan_basico_1', // Using this field to store MP plan identifier
      price: 25000, // ARS 25,000
      currency: 'ARS',
      interval: 'month',
      maxUsers: 5,
      maxUnits: 50,
      isActive: true,
    },
    {
      name: 'Plan Pro',
      description: 'Para concesionarias en crecimiento. Usuarios y vehículos ilimitados.',
      stripeProductId: 'mp_prod_pro',
      stripePriceId: 'mp_plan_pro_1',
      price: 45000, // ARS 45,000
      currency: 'ARS',
      interval: 'month',
      maxUsers: 9999,
      maxUnits: 9999,
      isActive: true,
    },
  ]

  for (const plan of plans) {
    const created = await prisma.saasPlan.upsert({
      where: { stripePriceId: plan.stripePriceId },
      update: plan,
      create: plan,
    })
    console.log(`✅ Upserted plan: ${created.name} (${created.stripePriceId})`)
  }

  console.log('Finished seeding Mercado Pago plans.')
}

main()
  .catch((e) => {
    console.error('Error seeding plans:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
