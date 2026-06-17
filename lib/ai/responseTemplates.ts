// lib/ai/responseTemplates.ts
import { ArgSpanishUtils } from './argSpanishUtils';

const BULLET = '•';

export class ResponseTemplates {
  /** Formatea estadísticas del dashboard */
  static formatDashboardStats(stats: any): string {
    return `📊 Estadísticas de su concesionaria:\n
${BULLET} ✅ Autos disponibles: ${stats.inventario.disponibles}\n
${BULLET} 🚗 Autos vendidos (histórico): ${stats.inventario.vendidos}\n
${BULLET} 👥 Clientes activos: ${stats.clientes.activos}\n
${BULLET} 🆕 Nuevos sin contactar: ${stats.clientes.nuevos_sin_contactar}\n
${BULLET} 💰 Ventas este mes: ${stats.operaciones.este_mes}\n
${BULLET} 💵 Estimado de ingresos mensuales: ~${ArgSpanishUtils.formatCurrency(stats.operaciones.este_mes * 1_500_000)}\n
*(Nota: Ingresos estimados basados en promedio histórico de $1.500.000 por venta)`;
  }

  /** Formatea lista de vehículos */
  static formatUnitsList(units: any[], found: number, queryContext?: string): string {
    if (found === 0) {
      return `🔍 No se encontraron vehículos que coincidan con:\n"${queryContext ?? 'su búsqueda'}.\n\n💡 Sugerencias:\n${BULLET} Verifique ortografía de marca/modelo\n${BULLET} Intente rango de precio más amplio\n${BULLET} Use "0km" para autos nuevos o "usado" para vehículos de segunda mano`;
    }

    const items = units.map(unit => {
      const priceText = unit.priceArs
        ? ArgSpanishUtils.formatCurrency(unit.priceArs)
        : 'Precio bajo consulta';
      return `${BULLET} ${unit.title}${unit.year ? ` (${unit.year})` : ''}\n
        💰 Precio: ${priceText}\n
        🚗 Estado: ${this.mapUnitStatus(unit.status)}\n
        📍 Ubicación: ${unit.location ?? 'No especificada'}\n
        🔗 Detalles: /app/units/${unit.id}`;
    }).join('\n\n');

    return `🚗 Resultados de búsqueda (${found} vehículo${found > 1 ? 's' : ''}):\n\n${items}\n\n💡 Tip: Puede refinar con marca, año o rango de precio (ej: "Toyota Corolla 2020 hasta 12 palos")`;
  }

  /** Formatea lista de leads */
  static formatLeadsList(leads: any[], found: number, queryContext?: string): string {
    if (found === 0) {
      return `🔍 No se encontraron leads que coincidan con:\n"${queryContext ?? 'su búsqueda'}."`;
    }

    const items = leads.map(lead =>
      `${BULLET} ${lead.name}\n
        📞 Teléfono: ${lead.phone ?? 'No proporcionado'}\n
        📧 Email: ${lead.email ?? 'No proporcionado'}\n
        🏷️ Estado: ${this.mapLeadStatus(lead.status)}\n
        📅 Creado: ${ArgSpanishUtils.formatDate(new Date(lead.createdAt))}\n
        🔗 Seguimiento: /app/leads/${lead.id}`
    ).join('\n\n');

    return `👥 Resultados de búsqueda (${found} lead${found > 1 ? 's' : ''}):\n\n${items}\n\n${BULLET} Sugerencia: Busque por nombre completo, teléfono o email para mayor precisión`;
  }

  /** Formatea lista de operaciones/ventas */
  static formatDealsList(deals: any[]): string {
    if (deals.length === 0) return "🔍 No se encontraron operaciones recientes.";

    const items = deals.map(deal =>
      `${BULLET} 🚗 ${deal.vehiculo}${deal.vehiculo.match(/\(\d{4}\)/)? '' : ` (${String(deal.vehiculo).slice(-4)})`}\n
        💰 Precio: ${deal.precio}\n
        👤 Cliente: ${deal.cliente}\n
        👨‍💼 Vendedor: ${deal.vendedor}\n
        📅 Fecha: ${deal.fecha}\n
        🏷️ Estado: ${deal.status}\n
        🔗 Detalles: /app/deals/${deal.id}`
    ).join('\n\n');

    return `💰 Operaciones recientes (${deals.length}):\n\n${items}\n\n${BULLET} Para ganancias netas del mes, pregunte: "¿Cuáles fueron nuestras ganancias este mes?"`;
  }

  /** Formatea creación exitosa de lead */
  static formatCreateLead(result: any): string {
    return `✅ Cliente creado exitosamente:\n
${BULLET} 👤 Nombre: ${result.name}\n
${BULLET} 📞 Teléfono: ${result.phone}\n
${BULLET} 📧 Email: ${result.email ?? 'No proporcionado'}\n
${BULLET} 🌐 Fuente: ${this.mapLeadSource(result.source ?? 'OTHER')}\n
${BULLET} 🆔 ID: ${result.id}\n
${BULLET} 🔗 Ver perfil: /app/leads/${result.id}`;
  }

  /** Formatea actualización de estado de lead */
  static formatUpdateLeadStatus(result: any): string {
    return `✅ Estado actualizado:\n
${BULLET} 👤 Cliente: ${result.name}\n
${BULLET} 🔄 Estado anterior → ${result.status}\n
${BULLET} 📝 Notas: ${result.notes ?? 'Ninguna'}\n
${BULLET} 🔗 Historial completo: /app/leads/${result.leadId}`;
  }

  /** Formatea actualización de estado de vehículo */
  static formatUpdateUnitStatus(result: any): string {
    return `✅ Estado del vehículo actualizado:\n
${BULLET} 🚗 Vehículo: ${result.title}${result.year ? ` (${result.year})` : ''}\n
${BULLET} 🔄 Estado anterior → ${result.status}\n
${BULLET} 🔗 Historial: /app/units/${result.unitId}`;
  }

  /** Respuesta cuando no se entiende la intención */
  static getClarificationResponse(): string {
    return `🤔 No entendí su solicitud. Para ayudarle mejor, intente reformular usando:\n\n🔹 Para inventario:\n${BULLET} "¿Cuántos 0km disponibles tenemos?"\n${BULLET} "Buscar usados de hasta 15 palos"\n${BULLET} "Mostrar Toyota Corolla 2020"\n${BULLET} "Autos marca Ford bajo 8 lucas"\n\n🔹 Para leads/clientes:\n${BULLET} "Buscar cliente llamado María González"\n${BULLET} "Mostrar leads de WhatsApp de esta semana"\n${BULLET} "Crear cliente Juan Pérez tel 1122334455 email juan@email.com"\n${BULLET} "Cambiar estado de lead Ana López a RESERVADO"\n\n🔹 Para ventas/estadísticas:\n${BULLET} "¿Cuántas ventas tuvimos este mes?"\n${BULLET} "Mostrar operaciones del mes actual"\n${BULLET} "¿Cuáles fueron nuestras ganancias este mes?"\n\nSi necesita ayuda específica, ¡estoy aquí para asistirlo! 💼`;
  }

  /** Manejo de errores técnicos (nunca mostrar detalles al usuario) */
  static handleError(action: string): string {
    console.error(`[RuleAgent] Error técnico en acción ${action}`);
    return `⚠️ Ocurrió un error interno al procesar su solicitud.\n\nPor favor:\n1. Verifique que los datos ingresados sean correctos (ej: números de teléfono, nombres exactos)\n2. Intente nuevamente en unos minutos\n3. Si el problema persiste, contacte a soporte con:\n   - Qué intentó hacer exactamente\n   - Hora aproximada del intento\n   - Captura de pantalla si es posible`;
  }

  // ==============================
  // MÉTODOS DE APOYO PARA FORMATTING
  // ==============================
  private static mapUnitStatus(status: 'AVAILABLE' | 'IN_PREP' | 'RESERVED' | 'SOLD'): string {
    const map: Record<typeof status, string> = {
      AVAILABLE: '✅ Disponible',
      IN_PREP: '🔧 En preparación',
      RESERVED: '⏳ Reservado',
      SOLD: '💰 Vendido'
    };
    return map[status];
  }

  private static mapLeadStatus(status: 'NEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'OFFER' | 'RESERVED' | 'SOLD' | 'LOST'): string {
    const map: Record<typeof status, string> = {
      NEW: '🆕 Nuevo',
      CONTACTED: '📞 Contactado',
      VISIT_SCHEDULED: '📅 Visita agendada',
      OFFER: '💬 En negociación',
      RESERVED: '⏳ Reservado',
      SOLD: '💰 Vendido',
      LOST: '❌ Perdido'
    };
    return map[status];
  }

  private static mapLeadSource(source: string): string {
    const map: Record<string, string> = {
      INSTAGRAM: '📸 Instagram',
      FACEBOOK_MARKETPLACE: '📘 Facebook Marketplace',
      REFERRAL: '👥 Referido',
      WALK_IN: '🚶 Cliente que entró caminando',
      PHONE: '📞 Llamada telefónica',
      WEBSITE: '🌐 Sitio web',
      WHATSAPP: '💬 WhatsApp',
      OTHER: '🔹 Otra fuente'
    };
    return map[source] || source;
  }
}