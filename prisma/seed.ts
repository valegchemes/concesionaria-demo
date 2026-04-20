import {
  PrismaClient,
  UserRole,
  UnitType,
  UnitStatus,
  AcquisitionType,
  LeadSource,
  LeadStatus,
  ActivityType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de base de datos...')

  // ── Company ──────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-id' },
    update: {},
    create: {
      id: 'demo-company-id',
      name: 'Concesionaria Demo',
      slug: 'demo',
      email: 'demo@concesionaria.com',
      phone: '+54 9 11 1234-5678',
      whatsappCentral: '+5491112345678',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      currencyPreference: 'BOTH',
    },
  })
  console.log('✅ Company:', company.slug)

  // ── Admin ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { id: 'demo-admin-id' },
    update: {},
    create: {
      id: 'demo-admin-id',
      email: 'admin@demo.com',
      name: 'Administrador',
      password: adminHash,
      role: UserRole.ADMIN,
      whatsappNumber: '+5491187654321',
      companyId: company.id,
    },
  })
  console.log('✅ Admin:', admin.email)

  // ── Seller ────────────────────────────────────────────────────────────
  const sellerHash = await bcrypt.hash('seller123', 10)
  const seller = await prisma.user.upsert({
    where: { id: 'demo-seller-id' },
    update: {},
    create: {
      id: 'demo-seller-id',
      email: 'vendedor@demo.com',
      name: 'Juan Vendedor',
      password: sellerHash,
      role: UserRole.SELLER,
      whatsappNumber: '+5491199998888',
      companyId: company.id,
    },
  })
  console.log('✅ Seller:', seller.email)

  // ── WhatsApp Templates ────────────────────────────────────────────────
  const templates = [
    {
      name: 'Bienvenida',
      template:
        'Hola {leadName}! Soy de {companyName}. Vi tu consulta sobre {unitTitle}. Te paso el link con fotos y precio: {publicUnitUrl}',
      isDefault: true,
    },
    {
      name: 'Seguimiento',
      template:
        'Hola {leadName}! Te escribo de {companyName} para saber si seguís interesado/a en {unitTitle}. Precio: ARS {unitPriceARS} / USD {unitPriceUSD}. ¡Esperamos tu respuesta!',
      isDefault: false,
    },
    {
      name: 'Precio Final',
      template:
        'Hola {leadName}! Confirmo precio final de {unitTitle}: ARS {unitPriceARS} (USD {unitPriceUSD}). Quedamos a tu disposición. {companyName}',
      isDefault: false,
    },
    {
      name: 'Turno Visita',
      template:
        'Hola {leadName}! Te confirmamos la visita para ver {unitTitle} en {companyName}. Te esperamos el {date} a las {time}. Cualquier consulta, escribinos!',
      isDefault: false,
    },
  ]

  for (const t of templates) {
    await prisma.whatsAppTemplate.upsert({
      where: { companyId_name: { companyId: company.id, name: t.name } },
      update: {},
      create: { ...t, companyId: company.id },
    })
  }
  console.log('✅ WhatsApp templates:', templates.length)

  // ── Units ─────────────────────────────────────────────────────────────
  const car = await prisma.unit.create({
    data: {
      type: UnitType.CAR,
      title: 'Toyota Corolla 2020 XLi CVT',
      description: 'Excelente estado, único dueño, service oficial al día. Color blanco perla, interior cuero.',
      priceArs: 25000000,
      priceUsd: 22000,
      status: UnitStatus.AVAILABLE,
      location: 'Buenos Aires',
      tags: ['automatico', 'nafta', 'unico_dueno', 'service_oficial'],
      vin: 'JTDBU4EE3B9123456',
      domain: 'ABC123',
      acquisitionCostArs: 20000000,
      acquisitionCostUsd: 18000,
      acquisitionType: AcquisitionType.PURCHASE,
      acquisitionDate: new Date('2024-01-15'),
      companyId: company.id,
    },
  })

  // Atributos del auto
  await prisma.unitAttribute.createMany({
    data: [
      { key: 'marca', value: 'Toyota', unitId: car.id },
      { key: 'modelo', value: 'Corolla', unitId: car.id },
      { key: 'año', value: '2020', unitId: car.id },
      { key: 'km', value: '45000', unitId: car.id },
      { key: 'combustible', value: 'Nafta', unitId: car.id },
      { key: 'transmision', value: 'Automática CVT', unitId: car.id },
      { key: 'color', value: 'Blanco Perla', unitId: car.id },
      { key: 'puertas', value: '4', unitId: car.id },
    ],
  })

  const moto = await prisma.unit.create({
    data: {
      type: UnitType.MOTORCYCLE,
      title: 'Honda CB 190R 2022',
      description: 'Impecable, 8.000 km, con accesorios originales. Una sola mano.',
      priceArs: 3500000,
      priceUsd: 3000,
      status: UnitStatus.AVAILABLE,
      location: 'Buenos Aires',
      tags: ['impecable', 'bajos_km', 'sport'],
      engineNumber: 'E123456',
      frameNumber: 'F789012',
      acquisitionCostArs: 2800000,
      acquisitionCostUsd: 2500,
      acquisitionType: AcquisitionType.PURCHASE,
      acquisitionDate: new Date('2024-03-10'),
      companyId: company.id,
    },
  })

  await prisma.unitAttribute.createMany({
    data: [
      { key: 'marca', value: 'Honda', unitId: moto.id },
      { key: 'modelo', value: 'CB 190R', unitId: moto.id },
      { key: 'año', value: '2022', unitId: moto.id },
      { key: 'km', value: '8000', unitId: moto.id },
      { key: 'cilindrada', value: '190cc', unitId: moto.id },
      { key: 'color', value: 'Rojo', unitId: moto.id },
    ],
  })

  const lancha = await prisma.unit.create({
    data: {
      type: UnitType.BOAT,
      title: 'Canestrari 160 Open 2018',
      description: 'Motor Mercury 90hp 4T con 150 hs. Trailer incluido. Hull en perfectas condiciones.',
      priceArs: 18000000,
      priceUsd: 15000,
      status: UnitStatus.AVAILABLE,
      location: 'Tigre',
      tags: ['motor_incluido', 'trailer', 'fibra'],
      hin: 'BRC1234567890',
      registrationNumber: 'MAT-456',
      acquisitionCostArs: 14000000,
      acquisitionCostUsd: 12000,
      acquisitionType: AcquisitionType.PURCHASE,
      acquisitionDate: new Date('2024-02-20'),
      companyId: company.id,
    },
  })

  await prisma.unitAttribute.createMany({
    data: [
      { key: 'marca', value: 'Canestrari', unitId: lancha.id },
      { key: 'modelo', value: '160 Open', unitId: lancha.id },
      { key: 'año', value: '2018', unitId: lancha.id },
      { key: 'eslora', value: '4.80m', unitId: lancha.id },
      { key: 'motor', value: 'Mercury 90hp 4T', unitId: lancha.id },
      { key: 'horas_motor', value: '150hs', unitId: lancha.id },
      { key: 'material', value: 'Fibra de vidrio', unitId: lancha.id },
    ],
  })

  console.log('✅ Units creadas: auto, moto, lancha')

  // ── Leads ─────────────────────────────────────────────────────────────
  const lead1 = await prisma.lead.create({
    data: {
      name: 'Carlos Rodríguez',
      phone: '+54 11 5555-1111',
      email: 'carlos@example.com',
      source: LeadSource.INSTAGRAM,
      status: LeadStatus.CONTACTED,
      notes: 'Interesado en el Corolla, quiere financiación',
      companyId: company.id,
      createdById: seller.id,
      assignedToId: seller.id,
      interestedUnitId: car.id,
    },
  })

  const lead2 = await prisma.lead.create({
    data: {
      name: 'María González',
      phone: '+54 11 5555-2222',
      source: LeadSource.FACEBOOK_MARKETPLACE,
      status: LeadStatus.NEW,
      notes: 'Consulta por WhatsApp, busca moto para ciudad',
      companyId: company.id,
      createdById: admin.id,
      assignedToId: seller.id,
      interestedUnitId: moto.id,
    },
  })

  const lead3 = await prisma.lead.create({
    data: {
      name: 'Roberto Pérez',
      phone: '+54 11 5555-3333',
      source: LeadSource.REFERRAL,
      status: LeadStatus.VISIT_SCHEDULED,
      notes: 'Viene referido por un cliente anterior. Quiere ver la lancha en persona.',
      companyId: company.id,
      createdById: seller.id,
      assignedToId: seller.id,
      interestedUnitId: lancha.id,
    },
  })

  console.log('✅ Leads creados:', 3)

  // ── Activities ────────────────────────────────────────────────────────
  await prisma.leadActivity.createMany({
    data: [
      {
        type: ActivityType.WHATSAPP_SENT,
        notes: 'Le envié las fotos del Corolla y el precio en ARS y USD',
        leadId: lead1.id,
        createdById: seller.id,
        companyId: company.id,
      },
      {
        type: ActivityType.CALL_MADE,
        notes: 'Llamé para consultar disponibilidad de financiación. Le dije que tiene cuotas.',
        leadId: lead1.id,
        createdById: seller.id,
        companyId: company.id,
      },
      {
        type: ActivityType.WHATSAPP_SENT,
        notes: 'Primer contacto por la moto CB 190R.',
        leadId: lead2.id,
        createdById: seller.id,
        companyId: company.id,
      },
      {
        type: ActivityType.VISIT_DONE,
        notes: 'Confirma visita para el martes a las 11hs para ver la lancha.',
        leadId: lead3.id,
        createdById: seller.id,
        companyId: company.id,
      },
    ],
  })
  console.log('✅ Activities creadas')

  // ── Tasks ─────────────────────────────────────────────────────────────
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  await prisma.task.createMany({
    data: [
      {
        title: 'Llamar a Carlos para confirmar visita al local',
        dueDate: tomorrow,
        leadId: lead1.id,
        assignedToId: seller.id,
        companyId: company.id,
      },
      {
        title: 'Enviar cotización de financiación para el Corolla',
        dueDate: tomorrow,
        leadId: lead1.id,
        assignedToId: seller.id,
        companyId: company.id,
      },
      {
        title: 'Confirmar visita de Roberto para ver la lancha',
        dueDate: nextWeek,
        leadId: lead3.id,
        assignedToId: seller.id,
        companyId: company.id,
      },
    ],
  })
  console.log('✅ Tasks creadas')

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('───────────────────────────────')
  console.log('  Admin:    admin@demo.com / admin123')
  console.log('  Vendedor: vendedor@demo.com / seller123')
  console.log('  Slug:     demo')
  console.log('───────────────────────────────')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
