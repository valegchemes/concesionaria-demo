
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- BUSCANDO PLANES ---')
  const plans = await prisma.saasPlan.findMany()
  console.log('Planes disponibles:', plans.map(p => ({ id: p.id, name: p.name })))

  console.log('\n--- BUSCANDO USUARIO ---')
  const devEmail = process.env.DEVELOPER_EMAILS?.split(',')[0]?.trim() || 'no-dev-configured@example.com'
  const user = await prisma.user.findFirst({
    where: { email: devEmail },
    include: {
      company: {
        include: {
          subscription: true
        }
      }
    }
  })

  if (!user) {
    console.error(`Usuario con email ${devEmail} no encontrado.`)
    return
  }

  console.log(`Usuario encontrado: ${user.name} (${user.id})`)
  console.log(`Compañía: ${user.company.name} (${user.company.id})`)
  console.log('Suscripción actual:', user.company.subscription ? {
    id: user.company.subscription.id,
    planId: user.company.subscription.planId,
    status: user.company.subscription.status
  } : 'Sin suscripción')

  const proPlan = plans.find(p => p.name.toLowerCase().includes('pro'))
  if (!proPlan) {
    console.error('No se encontró un plan "Pro".')
    return
  }

  console.log(`\n--- ACTUALIZANDO A PLAN PRO (${proPlan.name}) ---`)
  
  if (user.company.subscription) {
    const updated = await prisma.saasSubscription.update({
      where: { id: user.company.subscription.id },
      data: {
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 año desde ahora
      }
    })
    console.log('Suscripción actualizada exitosamente:', updated)
  } else {
    const created = await prisma.saasSubscription.create({
      data: {
        companyId: user.company.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    })
    console.log('Suscripción creada exitosamente:', created)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
