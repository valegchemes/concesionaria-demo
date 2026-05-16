import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Mercado Pago plans...')

  const plans = [
    {
      name: 'Plan Básico',
      description: 'Ideal para empezar. 1 usuario, hasta 15 vehículos en inventario.',
      stripeProductId: 'mp_prod_basico',
      stripePriceId: 'mp_plan_basico_1',
      price: 30000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 1,
      maxUnits: 15,
      analyticsEnabled: false,
      whatsappEnabled: false,
      isActive: true,
    },
    {
      name: 'Plan Medio',
      description: 'Para concesionarias en crecimiento. 3 usuarios, hasta 30 vehículos y analytics completos.',
      stripeProductId: 'mp_prod_medio',
      stripePriceId: 'mp_plan_medio_1',
      price: 55000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 3,
      maxUnits: 30,
      analyticsEnabled: true,
      whatsappEnabled: false,
      isActive: true,
    },
    {
      name: 'Plan Pro',
      description: 'Todo incluido. 5 usuarios, hasta 100 vehículos, analytics y WhatsApp activados.',
      stripeProductId: 'mp_prod_pro',
      stripePriceId: 'mp_plan_pro_1',
      price: 97000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 5,
      maxUnits: 100,
      analyticsEnabled: true,
      whatsappEnabled: true,
      isActive: true,
    },
  ]

  for (const plan of plans) {
    const created = await prisma.saasPlan.upsert({
      where: { stripePriceId: plan.stripePriceId },
      update: plan,
      create: plan,
    })
    console.log(`✅  ${created.name} — $${Number(created.price).toLocaleString('es-AR')} ARS | users:${created.maxUsers} units:${created.maxUnits} analytics:${created.analyticsEnabled} whatsapp:${created.whatsappEnabled}`)
  }

  console.log('\n🎉 Plans seeded successfully.')
}

main()
  .catch((e) => {
    console.error('Error seeding plans:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
