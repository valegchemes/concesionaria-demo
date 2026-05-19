import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Test Cron: Buscando compañías para desactivar (más de 30 días sin pagar/suscripción).')
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - 30) // 30 days ago

  const targetCompanies = await prisma.company.findMany({
    where: {
      isActive: true,
      OR: [
        {
          subscription: {
            status: { notIn: ['ACTIVE', 'INCOMPLETE'] },
            currentPeriodEnd: { lt: thresholdDate }
          }
        },
        {
          subscription: null,
          createdAt: { lt: thresholdDate }
        }
      ],
      users: {
        none: {
          email: 'valegchemes@gmail.com'
        }
      }
    },
    select: { id: true, name: true, createdAt: true, subscription: { select: { status: true, currentPeriodEnd: true } } }
  })

  if (targetCompanies.length === 0) {
    console.log('No hay ninguna compañía que cumpla los criterios para ser desactivada.')
  } else {
    console.log(`Se encontraron ${targetCompanies.length} compañías morosas o abandonadas:`)
    console.log(JSON.stringify(targetCompanies, null, 2))
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
