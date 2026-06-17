// lib/ai/responseTemplates.ts
import { ArgSpanishUtils } from './argSpanishUtils';

const BULLET = '•';

export class ResponseTemplates {
  /** Formatea estadísticas del dashboard */
  static formatDashboardStats(stats: any): string {
    return `📊 Estadísticas de su concesionaria:\n\n${BULLET} ✅ Autos disponibles: ${stats.inventario.disponibles}\n${BULLET} 🚗 Autos vendidos (histórico): ${stats.inventario.vendidos}\n${BULLET} 👥 Clientes activos: ${stats.clientes.activos}\n${BULLET} 🆕 Nuevos sin contactar: ${stats.clientes.nuevos_sin_contactar}\n${BULLET} 💰 Ventas este mes: ${stats.operaciones.este_mes}\n${BULLET} 💵 Gastos del mes: ${ArgSpanishUtils.formatCurrency(Number(stats.gastos_mes.ars) + Number(stats.gastos_mes.usd) * 1200)}\n\n*(Incluye gastos operativos del mes actual)*`;
  }

  /** Formatea lista de vehículos */
  static formatUnitsList(units: any[], found: number, queryContext?: string): string {
    if (found === 0) return `🔍 No se encontraron vehículos que coincidan con:\n"${queryContext ?? 'su búsqueda'}.\n\n💡 Sugerencias:\n${BULLET} Verifique ortografía de marca/modelo\n${BULLET} Intente rango de precio más amplio\n${BULLET} Use "0km" para autos nuevos o "usado" para vehículos de segunda mano`;
    const items = units.map(unit => {
      const marginInfo = unit.acquisitionCostArs != null
        ? `\n        📊 Margen estimado: ${ArgSpanishUtils.formatCurrency(Number(unit.priceArs?.replace(/[^0-9]/g, '') || 0) - Number(unit.acquisitionCostArs))}`
        : '';
      return `${BULLET} ${unit.title}${unit.year ? ` (${unit.year})` : ''}\n        💰 Precio: ${unit.priceArs ?? 'Bajo consulta'}${unit.priceUsd ? ` / ${unit.priceUsd}` : ''}\n        🚗 Estado: ${this.mapUnitStatus(unit.status)}\n        📍 Ubicación: ${unit.location ?? 'No especificada'}${marginInfo}\n        🔗 Detalles: /app/units/${unit.id}`;
    }).join('\n\n');
    return `🚗 Resultados de búsqueda (${found} vehículo${found > 1 ? 's' : ''}):\n\n${items}\n\n💡 Tip: Puede refinar con marca, año o rango de precio (ej: "Toyota Corolla 2020 hasta 12 palos")`;
  }

  /** Formatea lista de leads */
  static formatLeadsList(leads: any[], found: number, queryContext?: string): string {
    if (found === 0) return `🔍 No se encontraron leads que coincidan con:\n"${queryContext ?? 'su búsqueda'}."`;
    const items = leads.map(lead =>
      `${BULLET} ${lead.name}\n        📞 Teléfono: ${lead.phone ?? 'No proporcionado'}\n        📧 Email: ${lead.email ?? 'No proporcionado'}\n        🏷️ Estado: ${this.mapLeadStatus(lead.status)}\n        📅 Creado: ${ArgSpanishUtils.formatDate(new Date(lead.createdAt))}\n        🔗 Seguimiento: /app/leads/${lead.id}`
    ).join('\n\n');
    return `👥 Resultados de búsqueda (${found} lead${found > 1 ? 's' : ''}):\n\n${items}\n\n${BULLET} Sugerencia: Busque por nombre completo, teléfono o email para mayor precisión`;
  }

  /** Formatea lista de operaciones/ventas */
  static formatDealsList(deals: any[]): string {
    if (deals.length === 0) return "🔍 No se encontraron operaciones recientes.";
    const items = deals.map(deal => {
      const ganancia = deal.ganancia_neta != null ? `\n        📊 Ganancia neta: ${ArgSpanishUtils.formatCurrency(deal.ganancia_neta)}` : '';
      return `${BULLET} 🚗 ${deal.vehiculo}\n        💰 Precio: ${deal.precio}\n        👤 Cliente: ${deal.cliente}\n        👨‍💼 Vendedor: ${deal.vendedor}\n        📅 Fecha: ${deal.fecha}\n        🏷️ Estado: ${deal.status}${ganancia}\n        🔗 Detalles: /app/deals/${deal.id}`;
    }).join('\n\n');
    return `💰 Operaciones recientes (${deals.length}):\n\n${items}\n\n${BULLET} Para ganancias netas del mes, pregunte: "¿Cuáles fueron nuestras ganancias este mes?"`;
  }

  /** Formatea creación exitosa de lead */
  static formatCreateLead(result: any): string {
    return `✅ Cliente creado exitosamente:\n\n${BULLET} 👤 Nombre: ${result.name}\n${BULLET} 📞 Teléfono: ${result.phone}\n${BULLET} 📧 Email: ${result.email ?? 'No proporcionado'}\n${BULLET} 🆔 ID: ${result.id}\n${BULLET} 🔗 Ver perfil: /app/leads/${result.id}`;
  }

  /** Formatea actualización de estado de lead */
  static formatUpdateLeadStatus(result: any): string {
    return `✅ Estado de lead actualizado:\n\n${BULLET} 👤 Cliente: ${result.name}\n${BULLET} 🔄 Nuevo estado: ${result.status}\n${BULLET} 📝 Notas: ${result.notes ?? 'Ninguna'}\n${BULLET} 🔗 Historial: /app/leads/${result.leadId}`;
  }

  /** Formatea actualización de estado de vehículo */
  static formatUpdateUnitStatus(result: any): string {
    return `✅ Estado del vehículo actualizado:\n\n${BULLET} 🚗 Vehículo: ${result.title}${result.year ? ` (${result.year})` : ''}\n${BULLET} 🔄 Nuevo estado: ${result.status}\n${BULLET} 🔗 Historial: /app/units/${result.unitId}`;
  }

  // ===== NUEVOS FORMATOS =====

  /** Formatea registros de auditoría */
  static formatAuditLogs(result: any): string {
    if (result.found === 0) return `🔍 No se encontraron registros de auditoría.`;
    const items = result.logs.map((log: any) =>
      `${BULLET} [${new Date(log.createdAt).toLocaleString('es-AR')}] ${log.action} en ${log.resource}${log.resourceId ? ` (#${log.resourceId.slice(0, 8)})` : ''}`
    ).join('\n');
    return `📋 Últimos movimientos en el sistema (${result.found}):\n\n${items}\n\n${BULLET} Puede filtrar por recurso o acción para mayor detalle.`;
  }

  /** Formatea gastos mensuales */
  static formatCompanyExpenses(result: any): string {
    if (result.found === 0) return `🔍 No se encontraron gastos registrados.`;
    const items = result.expenses.map((e: any) =>
      `${BULLET} ${e.category}${e.description ? `: ${e.description}` : ''}\n        💰 ARS ${Number(e.amountArs).toLocaleString('es-AR')}${e.amountUsd > 0 ? ` / USD ${Number(e.amountUsd).toLocaleString()}` : ''}\n        📅 ${e.date}`
    ).join('\n\n');
    return `💸 Gastos registrados (${result.found}):\n\n${items}\n\n💰 Total ARS: ${ArgSpanishUtils.formatCurrency(Number(result.totalArs))}\n💰 Total USD: USD ${Number(result.totalUsd).toLocaleString()}`;
  }

  /** Formatea ganancia neta */
  static formatNetProfit(result: any): string {
    return `💰 Análisis de ganancias - ${result.periodo}:\n\n${BULLET} 📈 Ingresos brutos: ${ArgSpanishUtils.formatCurrency(result.ingresos_brutos)}\n${BULLET} 📉 Costos de adquisición: -${ArgSpanishUtils.formatCurrency(result.costos_adquisicion)}\n${BULLET} 📉 Costos operativos: -${ArgSpanishUtils.formatCurrency(result.costos_operativos)}\n${BULLET} 📉 Costos unitarios: -${ArgSpanishUtils.formatCurrency(result.costos_unitarios)}\n${BULLET} ─────────────────────────────\n${BULLET} ✅ Ganancia neta: ${ArgSpanishUtils.formatCurrency(result.ganancia_neta)}\n${BULLET} 📊 Margen: ${result.margen}%\n\n${BULLET} Operaciones en el período: ${result.cantidad_operaciones}`;
  }

  /** Formatea sesiones de caja */
  static formatCashSessions(result: any): string {
    if (result.found === 0) return `🔍 No se encontraron sesiones de caja.`;
    const items = result.sessions.map((s: any) =>
      `${BULLET} ${s.usuario} — ${s.estado === 'OPEN' ? '🟢 Abierta' : '🔴 Cerrada'}\n        📅 Apertura: ${new Date(s.apertura).toLocaleString('es-AR')}\n        💰 Saldo inicial: ${ArgSpanishUtils.formatCurrency(s.saldo_inicial)}${s.saldo_final ? `\n        💰 Saldo final: ${ArgSpanishUtils.formatCurrency(s.saldo_final)}` : ''}`
    ).join('\n\n');
    return `🏦 Sesiones de caja:\n\n${items}`;
  }

  /** Formatea tareas */
  static formatTasks(result: any): string {
    if (result.found === 0) return `✅ No hay tareas pendientes.`;
    const items = result.tasks.map((t: any) =>
      `${t.completa ? '✅' : '⏳'} ${t.titulo}\n        👤 Lead: ${t.lead} | 👨‍💼 Asignado: ${t.asignado}\n        📅 Vence: ${t.vencimiento}${t.descripcion ? `\n        📝 ${t.descripcion}` : ''}`
    ).join('\n\n');
    return `📋 Tareas (${result.found}):\n\n${items}`;
  }

  /** Formatea documentos digitales */
  static formatDocuments(result: any): string {
    if (result.found === 0) return `🔍 No se encontraron documentos.`;
    const items = result.documents.map((d: any) =>
      `${BULLET} ${d.tipo.replace(/_/g, ' ')} — ${d.estado}\n        👤 Cliente: ${d.cliente} | 🚗 ${d.vehiculo}\n        ${d.monto ? `💰 ${ArgSpanishUtils.formatCurrency(d.monto)}\n        ` : ''}📅 ${d.creado}\n        🔗 /app/units/${d.id}`
    ).join('\n\n');
    return `📄 Documentos (${result.found}):\n\n${items}`;
  }

  /** Formatea cuotas/pagarés */
  static formatInstallments(result: any): string {
    if (result.found === 0) return `✅ No hay cuotas pendientes.`;
    const items = result.installments.map((i: any) =>
      `${i.estado === 'OVERDUE' ? '🔴' : i.estado === 'PAID' ? '✅' : '⏳'} Cuota ${i.cuota} — ${ArgSpanishUtils.formatCurrency(i.monto)}\n        👤 ${i.cliente} | 🚗 ${i.vehiculo}\n        📅 Vence: ${i.vencimiento} | Estado: ${this.mapInstallmentStatus(i.estado)}`
    ).join('\n\n');
    return `📆 Cuotas y pagarés (${result.found}):\n\n${items}`;
  }

  /** Formatea finanzas de vehículo */
  static formatUnitFinances(result: any): string {
    if (!result.found) return `🔍 ${result.message}`;
    return `💰 Finanzas de ${result.vehiculo}:\n\n${BULLET} 💵 Precio de venta: ${ArgSpanishUtils.formatCurrency(result.precio_venta)}\n${BULLET} 📉 Costo de adquisición: ${ArgSpanishUtils.formatCurrency(result.costo_adquisicion)}${result.es_tomado_como_parte_de_pago ? ' (tomado como parte de pago)' : ''}\n${BULLET} 🔧 Costos de preparación: ${ArgSpanishUtils.formatCurrency(result.total_costos_asociados)}\n${BULLET} ─────────────────────────────\n${BULLET} 💰 Costo total: ${ArgSpanishUtils.formatCurrency(result.costo_total)}\n${BULLET} ✅ Margen estimado: ${ArgSpanishUtils.formatCurrency(result.margen_estimado)} (${result.margen_porcentaje}%)\n\n${result.costos_asociados.length > 0 ? `🔧 Costos asociados:\n${result.costos_asociados.map((c: any) => `  ${BULLET} ${c.concepto}: ${ArgSpanishUtils.formatCurrency(c.monto)}`).join('\n')}` : ''}`;
  }

  /** Formatea usuarios del sistema */
  static formatUsers(result: any): string {
    if (result.found === 0) return `🔍 No hay usuarios activos.`;
    const items = result.users.map((u: any) =>
      `${BULLET} ${u.nombre} — ${this.mapUserRole(u.rol)}\n        📧 ${u.email} | Comisión: ${u.comision}%\n        💰 ${u.operaciones} operaciones | ${u.leads_asignados} leads asignados`
    ).join('\n\n');
    return `👥 Usuarios del sistema (${result.found}):\n\n${items}`;
  }

  /** Formatea actividades de lead */
  static formatLeadActivities(result: any): string {
    if (result.found === 0) return `🔍 No se encontraron actividades.`;
    const items = result.activities.map((a: any) =>
      `${BULLET} [${new Date(a.creado).toLocaleString('es-AR')}] ${this.mapActivityType(a.tipo)}${a.notas ? `: ${a.notas}` : ''}\n        👤 ${a.creado_por}`
    ).join('\n\n');
    return `📝 Historial de actividades:\n\n${items}`;
  }

  /** Formatea finanzas de operación */
  static formatDealFinances(result: any): string {
    if (!result.found) return `🔍 ${result.message}`;
    let text = `💰 Finanzas de operación #${result.operacion.slice(0, 8)}:\n\n${BULLET} 🚗 ${result.vehiculo} — ${result.cliente}\n${BULLET} 📊 Estado: ${result.estado}\n${BULLET} 💵 Precio final: ${ArgSpanishUtils.formatCurrency(result.precio_final)} (${result.moneda})\n`;
    if (result.anticipo) text += `${BULLET} 💵 Anticipo: ${ArgSpanishUtils.formatCurrency(result.anticipo)}\n`;
    if (result.costo_adquisicion) text += `${BULLET} 📉 Costo adquisición: ${ArgSpanishUtils.formatCurrency(result.costo_adquisicion)}\n`;
    text += `${BULLET} ─────────────────────────────\n`;
    if (result.costos_cierre.length > 0) {
      text += `📋 Costos de cierre:\n${result.costos_cierre.map((c: any) => `  ${BULLET} ${c.concepto}: ${ArgSpanishUtils.formatCurrency(c.monto)}`).join('\n')}\n`;
      text += `${BULLET} Total costos cierre: ${ArgSpanishUtils.formatCurrency(result.total_costos_cierre)}\n`;
    }
    text += `${BULLET} 💰 Total pagado: ${ArgSpanishUtils.formatCurrency(result.total_pagado)}\n`;
    if (result.saldo_pendiente > 0) text += `${BULLET} ⚠️ Saldo pendiente: ${ArgSpanishUtils.formatCurrency(result.saldo_pendiente)}\n`;
    if (result.trade_in) text += `${BULLET} 🔄 Trade-in: ${result.trade_in.descripcion} (valor: ${ArgSpanishUtils.formatCurrency(result.trade_in.valor_final)})\n`;
    text += `${BULLET} 🔗 /app/deals/${result.operacion}`;
    return text;
  }

  /** Formatea ranking de vendedores */
  static formatTopSellers(result: any): string {
    if (result.found === 0) return `🔍 No hay datos de vendedores para este período.`;
    const items = result.sellers.map((s: any, i: number) =>
      `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} ${s.nombre}\n        💰 Total vendido: ${ArgSpanishUtils.formatCurrency(s.total_vendido)}\n        🚗 Operaciones: ${s.operaciones_cerradas}`
    ).join('\n\n');
    return `🏆 Ranking de vendedores (${result.periodo}):\n\n${items}`;
  }

  /** Respuesta cuando no se entiende la intención */
  static getClarificationResponse(): string {
    return `🤔 No entendí su solicitud. Puedo ayudarlo con:\n\n🔹 Inventario:\n${BULLET} "¿Qué autos tenemos disponibles?"\n${BULLET} "Buscar Toyota Corolla 2020"\n${BULLET} "Autos de hasta 15 palos"\n${BULLET} "Costos del vehículo Hilux"\n\n🔹 Clientes:\n${BULLET} "Mostrame clientes nuevos"\n${BULLET} "Buscar cliente llamado Juan"\n${BULLET} "Crear cliente María López tel 1122334455"\n\n🔹 Ventas y finanzas:\n${BULLET} "¿Cuántas ventas tuvimos este mes?"\n${BULLET} "¿Cuál fue la ganancia neta?"\n${BULLET} "Gastos del mes"\n${BULLET} "Ranking de vendedores"\n\n🔹 Gestión:\n${BULLET} "Últimas auditorías del sistema"\n${BULLET} "Tareas pendientes"\n${BULLET} "Cuotas por vencer"\n${BULLET} "Documentos generados"\n\n🔹 Sistema:\n${BULLET} "Mostrame los usuarios"\n${BULLET} "Estado de caja"\n${BULLET} "Finanzas de la operación #ID"\n\n¿Qué desea consultar? 😊`;
  }

  /** Manejo de errores técnicos */
  static handleError(action: string): string {
    console.error(`[RuleAgent] Error técnico en acción ${action}`);
    return `⚠️ Ocurrió un error interno al procesar su solicitud.\n\nPor favor:\n1. Verifique que los datos ingresados sean correctos\n2. Intente nuevamente en unos minutos\n3. Si el problema persiste, contacte a soporte técnico`;
  }

  // ===== MAPEOS =====
  private static mapUnitStatus(status: string): string {
    const map: Record<string, string> = { AVAILABLE: '✅ Disponible', IN_PREP: '🔧 En preparación', RESERVED: '⏳ Reservado', SOLD: '💰 Vendido' };
    return map[status] || status;
  }

  private static mapLeadStatus(status: string): string {
    const map: Record<string, string> = { NEW: '🆕 Nuevo', CONTACTED: '📞 Contactado', VISIT_SCHEDULED: '📅 Visita agendada', OFFER: '💬 En negociación', RESERVED: '⏳ Reservado', SOLD: '💰 Vendido', LOST: '❌ Perdido' };
    return map[status] || status;
  }

  private static mapInstallmentStatus(status: string): string {
    const map: Record<string, string> = { PENDING: '⏳ Pendiente', PAID: '✅ Pagada', OVERDUE: '🔴 Vencida' };
    return map[status] || status;
  }

  private static mapUserRole(role: string): string {
    const map: Record<string, string> = { ADMIN: '👑 Administrador', MANAGER: '👔 Gerente', SELLER: '🤝 Vendedor' };
    return map[role] || role;
  }

  private static mapActivityType(type: string): string {
    const map: Record<string, string> = {
      WHATSAPP_SENT: '💬 WhatsApp enviado', CALL_MADE: '📞 Llamada realizada', CALL_RECEIVED: '📞 Llamada recibida',
      VISIT_DONE: '🚶 Visita realizada', OFFER_RECEIVED: '💵 Oferta recibida', EMAIL_SENT: '📧 Email enviado',
      NOTE_ADDED: '📝 Nota agregada', STATUS_CHANGED: '🔄 Estado cambiado', TASK_COMPLETED: '✅ Tarea completada'
    };
    return map[type] || type;
  }
}
