import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const deals = await prisma.deal.findMany({
    where: { status: 'DELIVERED' },
    select: {
      id: true,
      status: true,
      finalPrice: true,
      finalPriceCurrency: true,
      exchangeRate: true,
      updatedAt: true,
      createdAt: true,
      leadId: true,
      unitId: true,
      sellerId: true,
      seller: {
        select: {
          name: true,
          id: true,
        },
      },
      unit: {
        select: {
          title: true,
          vin: true,
          domain: true,
        },
      },
      lead: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
    take: 50
  })
  
  const dealDetails = deals.map((deal) => {
    const finalPrice = deal.finalPrice ? Number(deal.finalPrice.toString()) : 0
    const exchangeRate = deal.exchangeRate ? Number(deal.exchangeRate.toString()) : 1000
    const currency = deal.finalPriceCurrency || 'ARS'

    return {
      id: deal.id,
      unitCode: deal.unit?.title || deal.unit?.vin || deal.unit?.domain || 'N/A',
      sellerName: deal.seller?.name || 'N/A',
      sellerId: deal.sellerId,
      finalPrice,
      currency,
      exchangeRate,
      status: deal.status,
      deliveredAt: deal.updatedAt.toISOString(),
      createdAt: deal.createdAt.toISOString(),
      buyerName: deal.lead?.name,
      buyerPhone: deal.lead?.phone,
      unitModel: deal.unit?.vin || deal.unit?.domain || undefined,
    }
  })
  console.log("Transformed successfully:", dealDetails.length)
}
test()
