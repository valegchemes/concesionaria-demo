import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const devEmail = process.env.DEVELOPER_EMAILS?.split(',')[0]?.trim() || 'no-dev-configured@example.com'
  const user = await prisma.user.findFirst({
    where: { email: devEmail },
    include: {
      company: {
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      }
    }
  })

  console.log('--- USUARIO BUSCADO ---')
  if (!user) {
    console.log(`No se encontró el usuario con email ${devEmail}`)
  } else {
    console.log('ID:', user.id)
    console.log('Nombre:', user.name)
    console.log('Email:', user.email)
    console.log('Compañía ID:', user.companyId)
    console.log('Compañía Nombre:', user.company?.name)
    const sub = user.company?.subscription
    if (sub) {
      console.log(`Suscripción encontrada: ID: ${sub.id}, Status: ${sub.status}, Plan: ${sub.plan?.name}, StripePriceID: ${sub.plan?.stripePriceId}`)
    } else {
      console.log('La compañía no tiene ninguna suscripción activa o pendiente.')
    }
  }

  // List all users to see if anyone was deleted
  const allUsers = await prisma.user.findMany({
    select: { email: true, name: true }
  })
  console.log('\n--- TODOS LOS USUARIOS EN BD ---')
  console.log(allUsers)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
  })
