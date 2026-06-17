/**
 * lib/ai/tools.ts
 * Herramientas (Function Calling) del Agente IA Copilot.
 *
 * Compatible con Vercel AI SDK v6.
 * Usamos objetos planos con tipado en el builder unificado.
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tool } from 'ai'

// ─── Builder unificado ────────────────────────────────────────────────────────
export function buildCopilotTools(companyId: string, userId: string) {
  return {
    searchUnits: tool({
      description: 'Busca vehículos en el inventario. Filtra por tipo, estado, precio o texto.',
      parameters: z.object({
        query: z.string().optional().describe('Texto libre para buscar en el título del vehículo'),
        status: z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD']).optional(),
        type: z.enum(['CAR', 'MOTORCYCLE', 'BOAT']).optional(),
        maxPriceArs: z.number().optional(),
        minPriceArs: z.number().optional(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { query, status, type, maxPriceArs, minPriceArs, limit } = args
        const units = await prisma.unit.findMany({
          where: {
            companyId,
            isActive: true,
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
            ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
            ...(maxPriceArs != null ? { priceArs: { lte: maxPriceArs } } : {}),
            ...(minPriceArs != null ? { priceArs: { gte: minPriceArs } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, title: true, type: true, status: true, year: true, priceArs: true, priceUsd: true, location: true },
        })
        if (!units.length) return { found: 0, units: [], message: 'No se encontraron vehículos.' }
        return {
          found: units.length,
          units: units.map((u) => ({
            id: u.id, title: u.title, type: u.type, status: u.status, year: u.year,
            priceArs: u.priceArs ? `$${Number(u.priceArs).toLocaleString('es-AR')}` : null,
            priceUsd: u.priceUsd ? `USD ${Number(u.priceUsd).toLocaleString()}` : null,
            location: u.location,
          })),
        }
      },
    }),

    searchLeads: tool({
      description: 'Busca clientes/prospectos por nombre, teléfono, email o estado.',
      parameters: z.object({
        query: z.string().optional().describe('Nombre, teléfono o email'),
        status: z.enum(['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED', 'SOLD', 'LOST']).optional(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { query, status, limit } = args
        const leads = await prisma.lead.findMany({
          where: {
            companyId, isActive: true,
            ...(status ? { status } : {}),
            ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { phone: { contains: query } }, { email: { contains: query, mode: 'insensitive' } }] } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, name: true, phone: true, email: true, status: true, source: true, createdAt: true },
        })
        if (!leads.length) return { found: 0, leads: [], message: 'No se encontraron clientes.' }
        return { found: leads.length, leads: leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) }
      },
    }),

    createLead: tool({
      description: 'Crea un nuevo cliente/prospecto en el CRM.',
      parameters: z.object({
        name: z.string().min(2),
        phone: z.string().min(6),
        email: z.string().email().optional(),
        source: z.enum(['INSTAGRAM', 'FACEBOOK_MARKETPLACE', 'REFERRAL', 'WALK_IN', 'PHONE', 'WEBSITE', 'WHATSAPP', 'OTHER']).default('OTHER'),
        notes: z.string().optional(),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const lead = await prisma.lead.create({
          data: { companyId, createdById: userId, ...args, status: 'NEW' },
          select: { id: true, name: true, phone: true, status: true },
        })
        return { success: true, message: `✅ Cliente "${args.name}" creado.`, lead, link: `/app/leads/${lead.id}` }
      },
    }),

    updateLeadStatus: tool({
      description: 'Actualiza el estado de un cliente existente.',
      parameters: z.object({
        leadId: z.string(),
        status: z.enum(['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'OFFER', 'RESERVED', 'SOLD', 'LOST']),
        notes: z.string().optional(),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { leadId, status, notes } = args
        const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId }, select: { name: true } })
        if (!existing) return { success: false, message: 'Cliente no encontrado.' }
        await prisma.lead.update({ where: { id: leadId }, data: { status, ...(notes ? { notes } : {}) } })
        return { success: true, message: `✅ Estado de "${existing.name}" actualizado a "${status}".`, link: `/app/leads/${leadId}` }
      },
    }),

    updateUnitStatus: tool({
      description: 'Cambia el estado de un vehículo en el inventario.',
      parameters: z.object({
        unitId: z.string(),
        status: z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD']),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { unitId, status } = args
        const existing = await prisma.unit.findFirst({ where: { id: unitId, companyId }, select: { title: true } })
        if (!existing) return { success: false, message: 'Vehículo no encontrado.' }
        await prisma.unit.update({ where: { id: unitId }, data: { status } })
        return { success: true, message: `✅ Estado de "${existing.title}" actualizado a "${status}".`, link: `/app/units/${unitId}` }
      },
    }),

    getDashboardStats: tool({
      description: 'Estadísticas: autos disponibles, clientes activos, ventas del mes.',
      parameters: z.object({}),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        console.log('[TOOL EXECUTION] getDashboardStats called!')
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const [disponibles, vendidos, clientesActivos, nuevosSinContactar, ventasMes] = await Promise.all([
          prisma.unit.count({ where: { companyId, status: 'AVAILABLE', isActive: true } }),
          prisma.unit.count({ where: { companyId, status: 'SOLD' } }),
          prisma.lead.count({ where: { companyId, isActive: true, status: { notIn: ['SOLD', 'LOST'] } } }),
          prisma.lead.count({ where: { companyId, status: 'NEW', isActive: true } }),
          prisma.deal.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
        ])
        return { inventario: { disponibles, vendidos }, clientes: { activos: clientesActivos, nuevos_sin_contactar: nuevosSinContactar }, operaciones: { este_mes: ventasMes } }
      },
    }),

    getDeals: tool({
      description: 'Obtiene operaciones/ventas recientes con detalles de cliente y vehículo.',
      parameters: z.object({
        status: z.enum(['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED']).optional(),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { status, limit } = args
        const deals = await prisma.deal.findMany({
          where: { companyId, ...(status ? { status } : {}) },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true, status: true, finalPrice: true, finalPriceCurrency: true, createdAt: true,
            lead: { select: { name: true, phone: true } },
            unit: { select: { title: true, year: true } },
            seller: { select: { name: true } },
          },
        })
        if (!deals.length) return { found: 0, deals: [], message: 'No se encontraron operaciones.' }
        return {
          found: deals.length,
          deals: deals.map((d) => ({
            id: d.id, status: d.status,
            precio: `${d.finalPriceCurrency} ${Number(d.finalPrice).toLocaleString('es-AR')}`,
            cliente: d.lead.name, vehiculo: `${d.unit.title}${d.unit.year ? ` (${d.unit.year})` : ''}`,
            vendedor: d.seller.name, fecha: d.createdAt.toLocaleDateString('es-AR'),
            link: `/app/deals/${d.id}`,
          })),
        }
      },
    }),
  }
}
