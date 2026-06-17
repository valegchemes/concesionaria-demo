/**
 * lib/ai/tools.ts
 * Herramientas (Function Calling) del Agente IA Copilot.
 * Compatible con Vercel AI SDK v6.
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { tool } from 'ai'

// ─── Helper para fechas ──────────────────────────────────────────────────────
function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

// ─── Builder unificado ────────────────────────────────────────────────────────
export function buildCopilotTools(companyId: string, userId: string) {
  return {
    // ===== EXISTENTES (mejoradas) =====

    searchUnits: tool({
      description: 'Busca vehículos en el inventario. Filtra por tipo, estado, precio o texto.',
      parameters: z.object({
        query: z.string().optional().describe('Texto libre para buscar en el título del vehículo'),
        status: z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD']).optional(),
        type: z.enum(['CAR', 'MOTORCYCLE', 'BOAT']).optional(),
        maxPriceArs: z.number().optional(),
        minPriceArs: z.number().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { query, status, type, maxPriceArs, minPriceArs, limit } = args
        const units = await prisma.unit.findMany({
          where: {
            companyId, isActive: true,
            ...(status ? { status } : {}),
            ...(type ? { type } : {}),
            ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
            ...(maxPriceArs != null ? { priceArs: { lte: maxPriceArs } } : {}),
            ...(minPriceArs != null ? { priceArs: { gte: minPriceArs } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, title: true, type: true, status: true, year: true, priceArs: true, priceUsd: true, location: true, acquisitionCostArs: true, acquisitionCostUsd: true },
        })
        if (!units.length) return { found: 0, units: [], message: 'No se encontraron vehículos.' }
        return {
          found: units.length,
          units: units.map((u) => ({
            id: u.id, title: u.title, type: u.type, status: u.status, year: u.year,
            priceArs: u.priceArs ? `$${Number(u.priceArs).toLocaleString('es-AR')}` : null,
            priceUsd: u.priceUsd ? `USD ${Number(u.priceUsd).toLocaleString()}` : null,
            acquisitionCostArs: u.acquisitionCostArs ? Number(u.acquisitionCostArs) : null,
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
        limit: z.number().int().min(1).max(30).default(15),
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
          select: { id: true, name: true, phone: true, email: true, status: true, source: true, assignedToId: true, createdAt: true },
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
      description: 'Estadísticas generales del dashboard: autos disponibles, clientes activos, ventas del mes, gastos mensuales.',
      parameters: z.object({}),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const som = startOfMonth()
        const [disponibles, vendidosHist, clientesActivos, nuevosSinContactar, ventasMes, gastosMes] = await Promise.all([
          prisma.unit.count({ where: { companyId, status: 'AVAILABLE', isActive: true } }),
          prisma.unit.count({ where: { companyId, status: 'SOLD' } }),
          prisma.lead.count({ where: { companyId, isActive: true, status: { notIn: ['SOLD', 'LOST'] } } }),
          prisma.lead.count({ where: { companyId, status: 'NEW', isActive: true } }),
          prisma.deal.count({ where: { companyId, createdAt: { gte: som } } }),
          prisma.companyExpense.aggregate({ where: { companyId, date: { gte: som, lte: endOfMonth() }, isActive: true }, _sum: { amountArs: true, amountUsd: true } }),
        ])
        return {
          inventario: { disponibles, vendidos: vendidosHist },
          clientes: { activos: clientesActivos, nuevos_sin_contactar: nuevosSinContactar },
          operaciones: { este_mes: ventasMes },
          gastos_mes: { ars: gastosMes._sum.amountArs || 0, usd: gastosMes._sum.amountUsd || 0 },
        }
      },
    }),

    getDeals: tool({
      description: 'Obtiene operaciones/ventas recientes con detalles de cliente, vehículo y vendedor.',
      parameters: z.object({
        status: z.enum(['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED']).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { status, limit } = args
        const deals = await prisma.deal.findMany({
          where: { companyId, ...(status ? { status } : {}) },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true, status: true, finalPrice: true, finalPriceCurrency: true, createdAt: true, closedAt: true,
            lead: { select: { name: true, phone: true } },
            unit: { select: { title: true, year: true, acquisitionCostArs: true } },
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
            ganancia_neta: d.unit.acquisitionCostArs
              ? Number(d.finalPrice) - Number(d.unit.acquisitionCostArs)
              : null,
            link: `/app/deals/${d.id}`,
          })),
        }
      },
    }),

    // ===== NUEVAS HERRAMIENTAS =====

    /** 1. Auditorías - Últimas acciones en el sistema */
    getAuditLogs: tool({
      description: 'Obtiene el registro de auditoría: acciones recientes en el sistema, filtrado por recurso, usuario o acción.',
      parameters: z.object({
        resource: z.string().optional().describe('Filtrar por tipo de recurso: Lead, Unit, Deal, User, Company, etc.'),
        action: z.string().optional().describe('Filtrar por acción: CREATE, UPDATE, DELETE, LOGIN, etc.'),
        limit: z.number().int().min(1).max(30).default(10),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { resource, action, limit } = args
        const logs = await prisma.auditLog.findMany({
          where: {
            companyId,
            ...(resource ? { resource: { contains: resource, mode: 'insensitive' } } : {}),
            ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, action: true, resource: true, resourceId: true, createdAt: true, userId: true },
        })
        if (!logs.length) return { found: 0, logs: [], message: 'No se encontraron registros de auditoría.' }
        return { found: logs.length, logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) }
      },
    }),

    /** 2. Gastos mensuales de la empresa */
    getCompanyExpenses: tool({
      description: 'Obtiene los gastos mensuales de la empresa. Filtra por categoría, mes o rango de fechas.',
      parameters: z.object({
        category: z.string().optional().describe('Categoría del gasto (ej: ALQUILER, SERVICIOS, SUELDOS, MARKETING, etc.)'),
        month: z.number().int().min(1).max(12).optional().describe('Mes (1-12)'),
        year: z.number().int().optional().describe('Año (ej: 2026)'),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { category, month, year, limit } = args
        const where: any = { companyId, isActive: true }
        if (category) where.category = { contains: category, mode: 'insensitive' }
        if (month || year) {
          const m = month || new Date().getMonth() + 1
          const y = year || new Date().getFullYear()
          where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59, 999) }
        }
        const expenses = await prisma.companyExpense.findMany({
          where, orderBy: { date: 'desc' }, take: limit,
          select: { id: true, category: true, description: true, amountArs: true, amountUsd: true, date: true },
        })
        const totals = await prisma.companyExpense.aggregate({
          where, _sum: { amountArs: true, amountUsd: true },
        })
        return {
          found: expenses.length,
          totalArs: totals._sum.amountArs || 0,
          totalUsd: totals._sum.amountUsd || 0,
          expenses: expenses.map((e) => ({
            ...e, amountArs: Number(e.amountArs), amountUsd: Number(e.amountUsd), date: e.date.toISOString().slice(0, 10),
          })),
        }
      },
    }),

    /** 3. Ganancia neta del período */
    getNetProfit: tool({
      description: 'Calcula la ganancia neta del negocio en un período. Fórmula: ingresos por ventas - costos de adquisición - gastos operativos.',
      parameters: z.object({
        month: z.number().int().min(1).max(12).optional().describe('Mes (1-12). Por defecto: mes actual'),
        year: z.number().int().optional().describe('Año. Por defecto: año actual'),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const m = args.month || new Date().getMonth() + 1
        const y = args.year || new Date().getFullYear()
        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59, 999)

        const [deals, expenses, unitCosts] = await Promise.all([
          // Deals DELIVERED o APPROVED del período
          prisma.deal.findMany({
            where: { companyId, status: { in: ['DELIVERED', 'APPROVED', 'IN_PAYMENT'] }, createdAt: { gte: start, lte: end } },
            select: { finalPrice: true, unit: { select: { acquisitionCostArs: true } } },
          }),
          // Gastos operativos del período
          prisma.companyExpense.aggregate({
            where: { companyId, date: { gte: start, lte: end }, isActive: true },
            _sum: { amountArs: true, amountUsd: true },
          }),
          // Costos de units vendidas
          prisma.unitCostItem.aggregate({
            where: { unit: { companyId, deals: { some: { createdAt: { gte: start, lte: end } } } } },
            _sum: { amountArs: true, amountUsd: true },
          }),
        ])

        const ingresosBrutos = deals.reduce((sum, d) => sum + Number(d.finalPrice), 0)
        const costosAdquisicion = deals.reduce((sum, d) => sum + (d.unit.acquisitionCostArs ? Number(d.unit.acquisitionCostArs) : 0), 0)
        const costosOperativos = Number(expenses._sum.amountArs || 0) + Number(expenses._sum.amountUsd || 0) * 1200
        const costosUnitarios = Number(unitCosts._sum.amountArs || 0) + Number(unitCosts._sum.amountUsd || 0) * 1200
        const gananciaNeta = ingresosBrutos - costosAdquisicion - costosOperativos - costosUnitarios

        return {
          periodo: `${m}/${y}`,
          cantidad_operaciones: deals.length,
          ingresos_brutos: ingresosBrutos,
          costos_adquisicion: costosAdquisicion,
          costos_operativos: costosOperativos,
          costos_unitarios: costosUnitarios,
          ganancia_neta: gananciaNeta,
          margen: deals.length > 0 ? Math.round((gananciaNeta / ingresosBrutos) * 100) : 0,
        }
      },
    }),

    /** 4. Sesiones de caja */
    getCashSessions: tool({
      description: 'Consulta las sesiones de caja abiertas o cerradas, con transacciones y balances.',
      parameters: z.object({
        status: z.enum(['OPEN', 'CLOSED']).optional().describe('Filtrar por estado de sesión'),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { status, limit } = args
        const sessions = await prisma.cashSession.findMany({
          where: { companyId, ...(status ? { status } : {}) },
          orderBy: { openedAt: 'desc' }, take: limit,
          select: {
            id: true, openedAt: true, closedAt: true, openingBalance: true, closingBalance: true,
            status: true, user: { select: { name: true } },
          },
        })
        if (!sessions.length) return { found: 0, sessions: [], message: 'No se encontraron sesiones de caja.' }
        return {
          found: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id, usuario: s.user.name, estado: s.status,
            apertura: s.openedAt.toISOString(), cierre: s.closedAt?.toISOString() || null,
            saldo_inicial: Number(s.openingBalance), saldo_final: s.closingBalance ? Number(s.closingBalance) : null,
          })),
        }
      },
    }),

    /** 5. Tareas de leads */
    getTasks: tool({
      description: 'Obtiene las tareas asignadas a leads/clientes. Filtra por estado de completitud o vendedor.',
      parameters: z.object({
        isCompleted: z.boolean().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { isCompleted, limit } = args
        const tasks = await prisma.task.findMany({
          where: { companyId, ...(isCompleted !== undefined ? { isCompleted } : {}) },
          orderBy: { dueDate: 'asc' }, take: limit,
          select: { id: true, title: true, description: true, dueDate: true, isCompleted: true, lead: { select: { name: true } }, assignedTo: { select: { name: true } } },
        })
        if (!tasks.length) return { found: 0, tasks: [], message: 'No se encontraron tareas.' }
        return {
          found: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id, titulo: t.title, descripcion: t.description || '', vencimiento: t.dueDate.toISOString().slice(0, 10),
            completa: t.isCompleted, lead: t.lead.name, asignado: t.assignedTo.name,
          })),
        }
      },
    }),

    /** 6. Documentos digitales */
    getDocuments: tool({
      description: 'Consulta documentos digitales (boletos de compraventa, recibos, contratos). Filtra por tipo o estado.',
      parameters: z.object({
        type: z.enum(['BOLETO_COMPRAVENTA', 'RECIBO', 'CONTRATO']).optional(),
        status: z.enum(['DRAFT', 'GENERATED', 'SIGNED']).optional(),
        limit: z.number().int().min(1).max(15).default(10),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { type, status, limit } = args
        const docs = await prisma.digitalDocument.findMany({
          where: { companyId, ...(type ? { type } : {}), ...(status ? { status } : {}) },
          orderBy: { createdAt: 'desc' }, take: limit,
          select: { id: true, type: true, status: true, referenceNumber: true, amount: true, createdAt: true, lead: { select: { name: true } }, unit: { select: { title: true } } },
        })
        if (!docs.length) return { found: 0, documents: [], message: 'No se encontraron documentos.' }
        return {
          found: docs.length,
          documents: docs.map((d) => ({
            id: d.id, tipo: d.type, estado: d.status, referencia: d.referenceNumber || '',
            monto: d.amount ? Number(d.amount) : null, cliente: d.lead.name, vehiculo: d.unit.title,
            creado: d.createdAt.toISOString().slice(0, 10),
          })),
        }
      },
    }),

    /** 7. Cuotas / pagarés */
    getInstallments: tool({
      description: 'Consulta cuotas y pagarés pendientes. Muestra vencimientos, montos y estado de pago.',
      parameters: z.object({
        status: z.enum(['PENDING', 'PAID', 'OVERDUE']).optional().describe('Filtrar por estado de la cuota'),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { status, limit } = args
        const installments = await prisma.installment.findMany({
          where: {
            promissoryNote: { companyId },
            ...(status ? { status } : { status: { in: ['PENDING', 'OVERDUE'] } }),
          },
          orderBy: { dueDate: 'asc' }, take: limit,
          select: {
            id: true, installmentNumber: true, amount: true, dueDate: true, status: true,
            promissoryNote: { select: { lead: { select: { name: true } }, unit: { select: { title: true } } } },
          },
        })
        if (!installments.length) return { found: 0, installments: [], message: 'No se encontraron cuotas pendientes.' }
        return {
          found: installments.length,
          installments: installments.map((i) => ({
            id: i.id, cuota: i.installmentNumber, monto: Number(i.amount),
            vencimiento: i.dueDate.toISOString().slice(0, 10), estado: i.status,
            cliente: i.promissoryNote.lead.name, vehiculo: i.promissoryNote.unit.title,
          })),
        }
      },
    }),

    /** 8. Costos de vehículos */
    getUnitFinances: tool({
      description: 'Muestra el desglose financiero de un vehículo: precio de venta, costo de adquisición, costos de reparación/preparación, margen estimado.',
      parameters: z.object({
        unitId: z.string(),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { unitId } = args
        const unit = await prisma.unit.findFirst({
          where: { id: unitId, companyId },
          select: {
            id: true, title: true, priceArs: true, acquisitionCostArs: true, acquisitionCostUsd: true,
            acquisitionDate: true, acquisitionType: true, isFromTradeIn: true,
            costItems: { select: { concept: true, amountArs: true, amountUsd: true } },
          },
        })
        if (!unit) return { found: false, message: 'Vehículo no encontrado.' }
        const totalCostItems = unit.costItems.reduce((sum, c) => sum + Number(c.amountArs || 0) + Number(c.amountUsd || 0) * 1200, 0)
        const costoAdquisicion = unit.acquisitionCostArs ? Number(unit.acquisitionCostArs) : 0
        const precioVenta = unit.priceArs ? Number(unit.priceArs) : 0
        const costoTotal = costoAdquisicion + totalCostItems
        return {
          found: true,
          vehiculo: unit.title,
          precio_venta: precioVenta,
          costo_adquisicion: costoAdquisicion,
          tipo_adquisicion: unit.acquisitionType,
          es_tomado_como_parte_de_pago: unit.isFromTradeIn,
          costos_asociados: unit.costItems.map((c) => ({ concepto: c.concept, monto: Number(c.amountArs || 0) })),
          total_costos_asociados: totalCostItems,
          costo_total: costoTotal,
          margen_estimado: precioVenta - costoTotal,
          margen_porcentaje: precioVenta > 0 ? Math.round(((precioVenta - costoTotal) / precioVenta) * 100) : 0,
        }
      },
    }),

    /** 9. Usuarios del sistema */
    getUsers: tool({
      description: 'Lista los usuarios del sistema con su rol, comisiones y estadísticas básicas.',
      parameters: z.object({}),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const users = await prisma.user.findMany({
          where: { companyId, isActive: true },
          select: {
            id: true, name: true, email: true, role: true, commissionRate: true,
            _count: { select: { deals: true, assignedLeads: true, createdLeads: true } },
          },
          orderBy: { name: 'asc' },
        })
        return {
          found: users.length,
          users: users.map((u) => ({
            id: u.id, nombre: u.name, email: u.email, rol: u.role,
            comision: Number(u.commissionRate), operaciones: u._count.deals,
            leads_asignados: u._count.assignedLeads, leads_creados: u._count.createdLeads,
          })),
        }
      },
    }),

    /** 10. Actividades de leads */
    getLeadActivities: tool({
      description: 'Obtiene el historial de actividades de un lead: llamadas, whatsapps, visitas, notas, cambios de estado.',
      parameters: z.object({
        leadId: z.string(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { leadId, limit } = args
        const activities = await prisma.leadActivity.findMany({
          where: { leadId, lead: { companyId } },
          orderBy: { createdAt: 'desc' }, take: limit,
          select: { id: true, type: true, notes: true, createdAt: true, createdBy: { select: { name: true } } },
        })
        if (!activities.length) return { found: 0, activities: [], message: 'No se encontraron actividades para este lead.' }
        return {
          found: activities.length,
          activities: activities.map((a) => ({
            id: a.id, tipo: a.type, notas: a.notes || '', creado: a.createdAt.toISOString(),
            creado_por: a.createdBy.name,
          })),
        }
      },
    }),

    /** 11. Finanzas de una operación */
    getDealFinances: tool({
      description: 'Desglose financiero completo de una operación: precio final, costos de cierre, pagos recibidos, comisión del vendedor, trade-in.',
      parameters: z.object({
        dealId: z.string(),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { dealId } = args
        const deal = await prisma.deal.findFirst({
          where: { id: dealId, companyId },
          select: {
            id: true, status: true, finalPrice: true, finalPriceCurrency: true, depositAmount: true,
            exchangeRate: true, commissionType: true, commissionValue: true, notes: true,
            seller: { select: { name: true, commissionRate: true } },
            lead: { select: { name: true } },
            unit: { select: { title: true, acquisitionCostArs: true } },
            closingCosts: { select: { concept: true, amountArs: true, amountUsd: true } },
            payments: { select: { amount: true, method: true, receivedAt: true } },
            tradeIn: { select: { description: true, expectedValue: true, offeredValue: true, finalValue: true } },
          },
        })
        if (!deal) return { found: false, message: 'Operación no encontrada.' }
        const totalCostosCierre = deal.closingCosts.reduce((s, c) => s + Number(c.amountArs || 0), 0)
        const totalPagos = deal.payments.reduce((s, p) => s + Number(p.amount), 0)
        return {
          found: true, operacion: deal.id, estado: deal.status,
          cliente: deal.lead.name, vehiculo: deal.unit.title,
          precio_final: Number(deal.finalPrice), moneda: deal.finalPriceCurrency,
          anticipo: deal.depositAmount ? Number(deal.depositAmount) : null,
          comision: { tipo: deal.commissionType, valor: Number(deal.commissionValue), vendedor: deal.seller.name },
          costo_adquisicion: deal.unit.acquisitionCostArs ? Number(deal.unit.acquisitionCostArs) : null,
          costos_cierre: deal.closingCosts.map((c) => ({ concepto: c.concept, monto: Number(c.amountArs || 0) })),
          total_costos_cierre: totalCostosCierre,
          pagos_recibidos: deal.payments.map((p) => ({ monto: Number(p.amount), metodo: p.method, fecha: p.receivedAt.toISOString().slice(0, 10) })),
          total_pagado: totalPagos,
          saldo_pendiente: Number(deal.finalPrice) - totalPagos,
          trade_in: deal.tradeIn ? { descripcion: deal.tradeIn.description, valor_ofrecido: Number(deal.tradeIn.offeredValue), valor_final: Number(deal.tradeIn.finalValue) } : null,
          link: `/app/deals/${deal.id}`,
        }
      },
    }),

    /** 12. Mejores vendedores del período */
    getTopSellers: tool({
      description: 'Ranking de vendedores con más operaciones cerradas en el mes o período.',
      parameters: z.object({
        limit: z.number().int().min(1).max(10).default(5),
      }),
      // @ts-expect-error - AI SDK tool inference issue
      execute: async (args: any) => {
        const { limit } = args
        const som = startOfMonth()
        const sellers = await prisma.user.findMany({
          where: { companyId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'SELLER'] } },
          select: {
            id: true, name: true, role: true,
            deals: { where: { createdAt: { gte: som }, status: { in: ['DELIVERED', 'APPROVED'] } }, select: { finalPrice: true } },
          },
        })
        const ranked = sellers.map((s) => ({
          nombre: s.name, rol: s.role,
          operaciones_cerradas: s.deals.length,
          total_vendido: s.deals.reduce((sum, d) => sum + Number(d.finalPrice), 0),
        })).sort((a, b) => b.total_vendido - a.total_vendido).slice(0, limit)
        return { found: ranked.length, sellers: ranked, periodo: 'este mes' }
      },
    }),
  }
}
