import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const plans = [
    {
      name: 'Plan Básico',
      description: 'Ideal para agencias pequeñas',
      stripeProductId: 'prod_basic_ars',
      stripePriceId: 'price_basic_ars',
      price: 30000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 1,
      maxUnits: 15,
      analyticsEnabled: false,
      whatsappEnabled: false,
    },
    {
      name: 'Plan Medio',
      description: 'Para agencias en crecimiento',
      stripeProductId: 'prod_medium_ars',
      stripePriceId: 'price_medium_ars',
      price: 60000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 3,
      maxUnits: 40,
      analyticsEnabled: true,
      whatsappEnabled: false,
    },
    {
      name: 'Plan Pro',
      description: 'La solución completa',
      stripeProductId: 'prod_pro_ars',
      stripePriceId: 'price_pro_ars',
      price: 110000,
      currency: 'ARS',
      interval: 'month',
      maxUsers: 8,
      maxUnits: 100,
      analyticsEnabled: true,
      whatsappEnabled: true,
    }
  ]

  console.log('Seeding plans...')
  
  // First disable all existing plans to keep them out of UI
  await prisma.saasPlan.updateMany({
    data: { isActive: false }
  })

  for (const plan of plans) {
    await prisma.saasPlan.upsert({
      where: { stripePriceId: plan.stripePriceId },
      update: {
        ...plan,
        isActive: true, // reactivate the ones we want
      },
      create: {
        ...plan,
        isActive: true,
      }
    })
    console.log(`Upserted plan: ${plan.name}`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
