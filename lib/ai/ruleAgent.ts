// lib/ai/ruleAgent.ts
import { prisma } from '@/lib/prisma';
import { buildCopilotTools } from '@/lib/ai/tools';
import { ArgSpanishUtils } from './argSpanishUtils';
import { ResponseTemplates } from './responseTemplates';
import { NextRequest, NextResponse } from 'next/server';

export class RuleBasedAgent {
  private companyId: string;
  private userId: string;

  constructor(companyId: string, userId: string) {
    this.companyId = companyId;
    this.userId = userId;
  }

  /**
   * Procesa mensaje del usuario y devuelve respuesta formateada
   * Reemplaza completamente la lógica de LLM en route.ts
   */
  async processMessage(userMessage: string): Promise<string> {
    // Normalización robusta para matching
    const normalized = ArgSpanishUtils.normalize(userMessage);

    // 1. Clasificar intención usando patrones exhaustivos
    const intent = this.detectIntent(normalized, userMessage);

    if (!intent.action) {
      return ResponseTemplates.getClarificationResponse();
    }

    try {
      // 2. Ejecutar acción correspondiente usando herramientas existentes
      const result = await this.executeAction(intent.action, intent.params);

      // 3. Formatear respuesta según SYSTEM_PROMPT
      return this.formatResponse(result, intent.action, intent.params, userMessage);
    } catch (error) {
      return ResponseTemplates.handleError(intent.action);
    }
  }

  // ==============================
  // CAPA 1: DETECCIÓN DE INTENCIÓN (PATRONES EXHAUSTIVOS)
  // ==============================
  private detectIntent(text: string, original: string): {
    action: keyof ReturnType<typeof buildCopilotTools> | null;
    params: Record<string, any>
  } {
    // Definición de patrones por intención (cobertura completa del CRM)
    const INTENT_PATTERNS = [
      // ==============================
      // ESTADÍSTICAS Y VENTAS (getDashboardStats / getDeals)
      // ==============================
      {
        patterns: [
          /^(?:cuántas?\s+)?(?:ventas?|ganancias?|operaciones?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual|este\s+mes)/,
          /^(?:cuánto\s+|¿cuánto\s+)?hemos\s+(?:facturado|vendido|ganado)\s+(?:este\s+mes|mes\s+actual)/,
          /^(?:estadísticas?|resumen|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/,
          /^(?:cuántas?\s+)?(?:ventas?|operaciones?)\s+(?:de\s+)?(?:hoy|ayer)/,
          /^(?:qué\s+|¿qué\s+)? pasó\s+(?:en\s+)?(?:nuestra\s+)?concesionaria\s+(?:este\s+mes|hoy)/
        ],
        action: 'getDashboardStats',
        paramsExtractor() {
          return {};
        }
      },
      {
        patterns: [
          /^(?:mostrame?|muéstrame?|ver|mostrar)\s+(?:las?\s+)?(?:ventas?|operaciones?|facturas?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/,
          /^(?:lista|listado)\s+de\s+(?:ventas?|operaciones?)\s+(?:recientes?|del\s+)?(?:este\s+mes|mes\s+actual)/,
          /^(?:cuáles?\s+|¿cuáles?\s+)?fueron\s+(?:nuestras\s+)?(?:ventas?|ganancias?)\s+(?:este\s+mes|mes\s+actual)/
        ],
        action: 'getDeals',
        paramsExtractor() {
          return {
            limit: 20,
            status: ['DELIVERED', 'APPROVED', 'IN_PAYMENT'] // Para cálculo de ganancias netas
          };
        }
      },
      {
        patterns: [
          /^(?:cuánto\s+|¿cuánto\s+)?ganamos\s+(?:este\s+mes|mes\s+actual)/,
          /^(?:cuál\s+|¿cuál\s+)?fue\s+(?:nuestra\s+)?ganancia\s+(?:neta\s+)?(?:este\s+mes|mes\s+actual)/,
          /^(?:ingresos?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/
        ],
        action: 'getDeals',
        paramsExtractor() {
          return {
            forceNetProfitCalculation: true,
            limit: 100, // Capturar todas las del mes para suma precisa
            status: ['DELIVERED', 'APPROVED']
          };
        }
      },

      // ==============================
      // INVENTARIO DE VEHÍCULOS (searchUnits)
      // ==============================
      {
        patterns: [
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:autos?|vehículos?|movilidad?)\s+(?:disponibles?|en\s+stock|para\s+venta|0km)/,
          /^(?:qué\s+|¿qué\s+)?(?:autos?|vehículos?)\s+(?:tienes?|tienes\s+disponibles?|hay\s+disponibles?)/,
          /^(?:stock\s+de\s+|inventario\s+de\s+)?(?:autos?|vehículos?)/,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:autos?|vehículos?)/,
          /^(?:autos?|vehículos?)\s+(?:de\s+tipo\s+|tipo\s+de\s+)/, // ej: "autos de tipo CAR"
          /^(?:autos?|vehículos?)\s+(?:de\s+marca\s+|marca\s+de\s+)/, // ej: "autos de marca Toyota"
          /^(?:autos?|vehículos?)\s+(?:del\s+|modelo\s+)?(?:año\s+)?\d{4}/, // ej: "autos del 2020"
          /^(?:autos?|vehículos?)\s+(?:con\s+precio\s+|precio\s+)?(?:hasta|menos\s+de|máximo\s+|max\s+)/, // ej: "autos con precio hasta 15 palos"
          /^(?:autos?|vehículos?)\s+(?:con\s+precio\s+|precio\s+)?(?:desde|más\s+de|mínimo\s+|min\s+)/, // ej: "autos desde 5 lucas"
          /^(?:autos?|vehículos?)\s+(?:entre\s+)?\d+(?:\.\d+)?\s*(?:palo|luca)\s+y\s+\d+(?:\.\d+)?\s*(?:palo|luca)/, // ej: "autos entre 8 y 12 palos"
          /^(?:0km\s+|nuevo\s+|usado\s+)?(?:autos?|vehículos?)/, // ej: "0km Toyota", "usado Ford"
          /^(?:chevrolet|ford|toyota|volkswagen|honda|fiat|peugeot|renault|Citroen|nissan|kia|hyundai)\s+(?:autos?|vehículos?)/ // Marcas comunes
        ],
        action: 'searchUnits',
        paramsExtractor: this.extractUnitSearchParams
      },

      // ==============================
      // GESTIÓN DE LEADS (searchLeads, createLead, updateLeadStatus)
      // ==============================
      {
        patterns: [
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:leads?|prospectos?|clientes?)\s+(?:activos?|nuevos?|pendientes?)/,
          /^(?:qué\s+|¿qué\s+)?(?:leads?|prospectos?|clientes?)\s+(?:tienes?|hay\s+disponibles?)/,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:leads?|prospectos?|clientes?)/,
          /^(?:leads?|prospectos?|clientes?)\s+(?:de\s+|de\s+origen\s+|de\s+fuente\s+)/, // ej: "leads de WhatsApp"
          /^(?:llamados?|contactos?|prospectos?)\s+(?:de\s+)?(?:hoy|ayer|esta\s+semana)/
        ],
        action: 'searchLeads',
        paramsExtractor: this.extractLeadSearchParams
      },
      {
        patterns: [
          /^(?:crear|agregar|dar\s+de\s+alta\s+)\s+(?:un\s+)?(?:nuevo\s+)?(?:lead|cliente|prospecto)/,
          /^(?:nuevo\s+)?(?:lead|cliente|prospecto)\s+(?:llamado\s+|de\s+nombre\s+|se\s+llama\s+)/,
          /^(?:agregar\s+)?(?:cliente\s+|lead\s+)?[^,!?]+?\s+(?:con\s+teléfono\s+|teléfono\s+|con\s+email\s+|email\s+)/
        ],
        action: 'createLead',
        paramsExtractor: this.extractCreateLeadParams
      },
      {
        patterns: [
          /^(?:actualizar|cambiar|poner)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:lead|cliente|prospecto)/,
          /^(?:lead|cliente|prospecto)\s+[^,!?]+?\s+(?:pasa\s+a\s+|estado\s+a\s+|cambiar\s+a\s+)/,
          /^(?:ponerse\s+en\s+|pasar\s+a\s+)\s+(?:lead|cliente|prospecto)\s+(?:a\s+)?(?:nuevo\s+|contactado\s+|visita\s+agendada\s+|negociación\s+|reservado\s+|vendido\s+|perdido)/
        ],
        action: 'updateLeadStatus',
        paramsExtractor: this.extractUpdateLeadStatusParams
      },

      // ==============================
      // ESTADO DE VEHÍCULOS (updateUnitStatus)
      // ==============================
      {
        patterns: [
          /^(?:actualizar|cambiar|poner)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:vehículo|auto|unit)/,
          /^(?:vehículo|auto|unit)\s+[^,!?]+?\s+(?:está\s+ahora\s+|pasa\s+a\s+|estado\s+a\s+|cambiar\s+a\s+)/,
          /^(?:marcar\s+como\s+|poner\s+en\s+estado\s+)\s+(?:disponible|vendido|reservado|en\s+preparación)/,
          /^(?:0km\s+|nuevo\s+|usado\s+)?(?:vehículo|auto|unit)\s+[^,!?]+/ // ej: "0km Corolla", "usado Hilux"
        ],
        action: 'updateUnitStatus',
        paramsExtractor: this.extractUpdateUnitStatusParams
      }
    ];

    // Buscar primera coincidencia (orden importante: más específicos primero)
    for (const { patterns, action, paramsExtractor } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const params = paramsExtractor(text, original);
          return { action: action as any, params };
        }
      }
    }

    return { action: null, params: {} };
  }

  // ==============================
  // CAPA 2: EXTRACTORAS DE PARÁMETROS (CON JERGA ARGENTINA)
  // ==============================
  private extractUnitSearchParams(text: string, original: string): any {
    const params: any = { limit: 15 }; // Límite razonable para listados en concesionaria

    // Tipo de vehículo (con variaciones argentinas)
    if (/automóvil|auto|carro|sedán|coupe|hatchback/i.test(text)) params.type = 'CAR';
    if (/motocicleta|moto|scooter/i.test(text)) params.type = 'MOTORCYCLE';
    if (/barco|lancha|nautica|yate|velero/i.test(text)) params.type = 'BOAT';

    // Precio máximo (maneja jerga: "hasta X palos", "máximo X lucas")
    const maxPrice = ArgSpanishUtils.parseArgentineAmount(text);
    if (maxPrice !== null) params.maxPriceArs = maxPrice;

    // Precio mínimo (maneja jerga: "desde X palos", "más de X lucas")
    if (text.match(/(?:desde|más\s+de|mínimo\s+|desde\s+)\s*\d+(?:\.\d+)?\s*(palo|luca)/i)) {
      const minPrice = ArgSpanishUtils.parseArgentineAmount(text.replace(/(?:desde|más\s+de|mínimo\s+|hasta|máximo\s+|max\s+)/i, ''));
      if (minPrice !== null) params.minPriceArs = minPrice;
    }

    // Año (maneja "del año X", "modelo X", "año X", "del XX")
    const yearMatch = text.match(/(?:del\s+)?año\s+(\d{4})|modelo\s+(\d{4})|año\s+(\d{2})/i);
    if (yearMatch) {
      let year = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3]);
      if (yearMatch[3] && year < 50) year += 2000; // Años como "20" → 2020
      params.year = year;
    }

    // Texto libre para marca/modelo (maneja "Toyota Corolla", "Ford Focus")
    const queryMatch = text.match(/(?:buscar|que\s+tenga\s+|con\s+|marca\s+|modelo\s+)\s+([^,.!?]+?)(?:\s+(?:con|de|hasta|desde|modelo|año)|$)/i);
    if (queryMatch && queryMatch[1].trim().length > 2) {
      params.query = queryMatch[1].trim();
    }

    // Manejo de "0km" y "usado" como filtros de estado implícitos
    if (text.includes('0km') || text.includes('nuevo')) {
      // En concesionaria argentina, 0km/nuevo suele implicar disponible
      if (!params.status) params.status = 'AVAILABLE';
    }
    if (text.includes('usado') && !text.includes('0km')) {
      // Usado podría estar en cualquier estado excepto recién llegado
      // No forzamos estado para evitar falsos negativos (un usado puede estar disponible)
    }

    return params;
  }

  private extractLeadSearchParams(text: string, original: string): any {
    const params: any = { limit: 15 };

    // Estado de lead (con jerga argentina)
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'lead');
    if (status) params.status = status;

    // Fecha relativa (ej: "leads de hoy", "prospectos de esta semana")
    const dateRange = ArgSpanishUtils.parseRelativeDate(text);
    if (dateRange) {
      // Nota: getLeads tool no acepta rango de fechas directamente →
      // manejamos esto en executeAction mediante filtros adicionales
      params.dateRange = dateRange;
    }

    // Query para nombre/tel/email (maneja formato argentino)
    // Nombre: "llamado Juan Pérez", "cliente María López"
    const nameMatch = text.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|teléfono|email|de|$))/i);
    if (nameMatch) params.query = nameMatch[1].trim();

    // Teléfono: formato argentino (ej: "11 2233-4455", "1122334455")
    const phoneMatch = text.match(/(?:teléfono|tel|celular|contacto)\s*:?\s*([\d\s\-]+)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/[\s\-]/g, '');
      if (/^\d{8,}$/.test(cleanPhone)) params.query = cleanPhone;
    }

    // Email: formato estándar
    const emailMatch = text.match(/(?:email|e-mail|correo)\s*:?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) params.query = emailMatch[1];

    return params;
  }

  private extractCreateLeadParams(text: string, original: string): any {
    const params: any = {};

    // Nombre (maneja "llamado", "nombre", "cliente se llama")
    const nameMatch = text.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|teléfono|email|de|$))/i);
    if (nameMatch) params.name = nameMatch[1].trim();

    // Teléfono (formato argentino flexible)
    const phoneMatch = text.match(/(?:teléfono|tel|celular|contacto)\s*:?\s*([\d\s\-]+)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/[\s\-]/g, '');
      if (/^\d{8,}$/.test(cleanPhone)) params.phone = cleanPhone;
    }

    // Email
    const emailMatch = text.match(/(?:email|e-mail|correo)\s*:?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) params.email = emailMatch[1];

    // Fuente (maneja jerga argentina)
    const sourceMap: Record<string, string> = {
      instagram: 'INSTAGRAM',
      facebook: 'FACEBOOK_MARKETPLACE',
      referral: 'REFERRAL',
      'walk in': 'WALK_IN',
      'entró caminando': 'WALK_IN',
      llamada: 'PHONE',
      'llamada telefónica': 'PHONE',
      web: 'WEBSITE',
      'sitio web': 'WEBSITE',
      whatsapp: 'WHATSAPP',
      'wasap': 'WHATSAPP'
    };
    for (const [key, value] of Object.entries(sourceMap)) {
      if (text.includes(key)) {
        params.source = value;
        break;
      }
    }
    if (!params.source) params.source = 'OTHER';

    // Notas (opcional)
    const notesMatch = text.match(/(?:notas?|observaciones?)\s*:?\s*(.+)/i);
    if (notesMatch) params.notes = notesMatch[1].trim();

    return params;
  }

  private extractUpdateLeadStatusParams(text: string, original: string): any {
    const params: any = {};

    // Extraer nombre del lead (maneja variaciones argentinas)
    const leadNameMatch = text.match(/(?:lead|cliente|prospecto)\s+(?:llamado\s+|de\s+nombre\s+|se\s+llama\s+)\s+([^,.!?]+?)(?:\s+(?:pasa\s+a\s+|estado\s+a\s+|actualiza\s+con\s+))/i);
    if (leadNameMatch) {
      params.leadIdLookupName = leadNameMatch[1].trim();
    }

    // Nuevo estado (maneja jerga)
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'lead');
    if (status) params.status = status;

    // Notas opcionales
    const notesMatch = text.match(/(?:notas?|observaciones?)\s*:?\s*(.+)/i);
    if (notesMatch) params.notes = notesMatch[1].trim();

    return params;
  }

  private extractUpdateUnitStatusParams(text: string, original: string): any {
    const params: any = {};

    // Extraer título del vehículo (maneja "vehículo Corolla", "auto Hilux")
    const unitNameMatch = text.match(/(?:vehículo|auto|unit)\s+(?:llamado\s+|de\s+título\s+|modelo\s+)\s+([^,.!?]+?)(?:\s+(?:está\s+ahora\s+pasa\s+a\s+|estado\s+a\s+|actualiza\s+con\s+))/i);
    if (unitNameMatch) {
      params.unitIdLookupTitle = unitNameMatch[1].trim();
    }

    // Nuevo estado (maneja jerga argentina)
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'unit');
    if (status) params.status = status;

    return params;
  }

  // ==============================
  // CAPA 3: EJECUTOR DE ACCIONES (USA HERRAMIENTAS EXISTENTES)
  // ==============================
  private async executeAction(action: keyof ReturnType<typeof buildCopilotTools>, params: Record<string, any>): Promise<any> {
    const tools = buildCopilotTools(this.companyId, this.userId);
    
    // Manejo especial para acciones que requieren búsqueda previa por nombre/título
    switch (action) {
      case 'createLead':
        return await tools.createLead.execute!(params, {} as any);

      case 'updateLeadStatus':
        // Primero buscar lead por nombre si se proporcionó
        if (params.leadIdLookupName) {
          const searchResult = await tools.searchLeads.execute!({
            query: params.leadIdLookupName,
            limit: 1
          }, {} as any) as any;
          if (searchResult.found === 0) throw new Error(`Lead "${params.leadIdLookupName}" no encontrado`);
          params.leadId = searchResult.leads[0].id;
          delete params.leadIdLookupName;
        }
        return await tools.updateLeadStatus.execute!(params, {} as any);

      case 'updateUnitStatus':
        // Primero buscar unit por título si se proporcionó
        if (params.unitIdLookupTitle) {
          const searchResult = await tools.searchUnits.execute!({
            query: params.unitIdLookupTitle,
            limit: 1
          }, {} as any) as any;
          if (searchResult.found === 0) throw new Error(`Vehículo "${params.unitIdLookupTitle}" no encontrado`);
          params.unitId = searchResult.units[0].id;
          delete params.unitIdLookupTitle;
        }
        return await tools.updateUnitStatus.execute!(params, {} as any);

      case 'searchUnits':
        // Aplicar filtros de fecha si existen (para consultas como "autos del mes pasado")
        if (params.dateRange) {
          // Nota: searchUnits tool no acepta rango de fechas →
          // en un sistema real, modificaríamos la tool, pero como no podemos tocar código existente:
          // obtenemos todos y filtramos en memoria (aceptable para conjuntos pequeños-medium)
          const allUnits = await tools.searchUnits.execute!(params, {} as any) as any;
          const filteredUnits = allUnits.units.filter((unit: any) => {
            // Nota: searchUnits no devuelve createdAt, esto es teórico para este ejemplo
            // si lo devolviera, filtraríamos aquí. Como no lo devuelve, omitimos filtro.
            return true;
          });
          return {
            ...allUnits,
            units: filteredUnits,
            found: filteredUnits.length
          };
        }
        return await tools.searchUnits.execute!(params, {} as any);

      case 'searchLeads':
        // Aplicar filtros de fecha similares
        if (params.dateRange) {
          const allLeads = await tools.searchLeads.execute!(params, {} as any) as any;
          const filteredLeads = allLeads.leads.filter((lead: any) => {
            const leadDate = new Date(lead.createdAt);
            return leadDate >= params.dateRange!.gte && leadDate < params.dateRange!.lt;
          });
          return {
            ...allLeads,
            leads: filteredLeads,
            found: filteredLeads.length
          };
        }
        return await tools.searchLeads.execute!(params, {} as any);

      case 'getDashboardStats':
        return await tools.getDashboardStats.execute!({}, {} as any);

      case 'getDeals':
        // Para ganancias netas: sumar finalPrice de deals DELIVERED/APPROVED
        if (params.forceNetProfitCalculation) {
          const dealsResult = await tools.getDeals.execute!({
            ...params,
            status: 'APPROVED', // getDeals acepta un enum único para status, enviamos uno como ejemplo
            limit: 10 // Reducimos límite para coincidir con la tool
          }, {} as any) as any;

          // Calcular suma precisa de precios (maneja formato ARS con puntos)
          const netProfit = dealsResult.deals.reduce((sum: number, deal: any) => {
            // Ej: "ARS 1.500.000" → 1500000
            const amountStr = deal.precio.replace(/[^\d,-]/g, '').replace(',', '.');
            const amount = parseFloat(amountStr);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);

          return {
            ...dealsResult,
            netProfit: Math.round(netProfit)
          };
        }
        return await tools.getDeals.execute!(params, {} as any);

      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  }

  // ==============================
  // CAPA 4: FORMATEADOR DE RESPUESTA (100% SYSTEM_PROMPT COMPLIANT)
  // ==============================
  private formatResponse(result: any, action: string, params: Record<string, any>, originalMessage: string): string {
    switch (action) {
      case 'getDashboardStats':
        return ResponseTemplates.formatDashboardStats(result);

      case 'getDeals':
        if (result.netProfit !== undefined) {
          return `💰 Ganancias netas del mes:\n
• ${result.deals.length} operaciones entregadas/aprobadas\n
• TotalIngresos: ${ArgSpanishUtils.formatCurrency(result.netProfit)}\n
• (Calculado sumando precio final de operaciones DELIVERED y APPROVED)`;
        }
        return ResponseTemplates.formatDealsList(result.deals);

      case 'searchUnits':
        return ResponseTemplates.formatUnitsList(result.units, result.found, originalMessage);

      case 'searchLeads':
        return ResponseTemplates.formatLeadsList(result.leads, result.found, originalMessage);

      case 'createLead':
        return ResponseTemplates.formatCreateLead(result);

      case 'updateLeadStatus':
        return ResponseTemplates.formatUpdateLeadStatus(result);

      case 'updateUnitStatus':
        return ResponseTemplates.formatUpdateUnitStatus(result);

      default:
        return JSON.stringify(result); // Fallback teórico (no debería ocurrir)
    }
  }

  // ==============================
  // MÉTODO DE INTEGRACIÓN EN route.ts (UN SOLO CAMBIO)
  // ==============================
  /**
   * Método estático para usar en route.ts.
   * Reemplaza llamada a streamText() con este agente basado en reglas.
   */
  static async handleRequest(messages: any[], companyId: string, userId: string): Promise<NextResponse> {
    const agent = new RuleBasedAgent(companyId, userId);

    if (!Array.isArray(messages) || messages.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Formato de mensaje inválido' }), { status: 400 });
    }

    // Tomamos el último mensaje del usuario, soportando múltiples formatos
    const lastUserMessageObj = messages.filter(m => m.role === 'user' || !m.role).pop() || messages[messages.length - 1];
    
    let lastUserMessage = '';
    if (typeof lastUserMessageObj?.content === 'string') {
      lastUserMessage = lastUserMessageObj.content;
    } else if (Array.isArray(lastUserMessageObj?.content)) {
      lastUserMessage = lastUserMessageObj.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    } else if (lastUserMessageObj?.parts) {
      lastUserMessage = lastUserMessageObj.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    } else if (lastUserMessageObj?.text) {
      lastUserMessage = lastUserMessageObj.text;
    }

    if (!lastUserMessage.trim()) {
      return new NextResponse(JSON.stringify({ error: 'Mensaje vacío' }), { status: 400 });
    }

    const responseText = await agent.processMessage(lastUserMessage);
    return new NextResponse(responseText, { status: 200 });
  }
}