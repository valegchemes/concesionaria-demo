import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando actualización de reglas y límites de planes...')

  // 1. Update Plan Básico: analyticsEnabled = true
  const basico = await prisma.saasPlan.findFirst({
    where: { name: 'Plan Básico' }
  })
  if (basico) {
    await prisma.saasPlan.update({
      where: { id: basico.id },
      data: { analyticsEnabled: true }
    })
    console.log('✓ Plan Básico: Habilitado analíticas y matemáticas de ventas')
  }

  // 2. Update Plan Medio to Plan Standar and enable whatsappEnabled = true
  const medio = await prisma.saasPlan.findFirst({
    where: { name: 'Plan Medio' }
  })
  if (medio) {
    await prisma.saasPlan.update({
      where: { id: medio.id },
      data: { 
        name: 'Plan Standar',
        whatsappEnabled: true
      }
    })
    console.log('✓ Plan Medio renombrado a Plan Standar y habilitado WhatsApp')
  } else {
    // Check if it was already renamed
    const standar = await prisma.saasPlan.findFirst({
      where: { name: 'Plan Standar' }
    })
    if (standar) {
      await prisma.saasPlan.update({
        where: { id: standar.id },
        data: { whatsappEnabled: true }
      })
      console.log('✓ Plan Standar ya existía: Asegurado WhatsApp habilitado')
    }
  }

  console.log('🎉 Actualización de base de datos finalizada con éxito.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
