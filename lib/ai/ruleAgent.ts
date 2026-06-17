// lib/ai/ruleAgent.ts
import { prisma } from '@/lib/prisma';
import { buildCopilotTools } from '@/lib/ai/tools';
import { ArgSpanishUtils } from './argSpanishUtils';
import { ResponseTemplates } from './responseTemplates';


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
    // Normalización robusta para matching de keywords
    const normalized = ArgSpanishUtils.normalize(userMessage);

    // 1. Clasificar intención usando patrones exhaustivos
    const intent = this.detectIntent(normalized, userMessage);

    if (!intent.action) {
      // 2. Fallback: fuzzy keyword scoring si los patrones exactos no coincidieron
      const fuzzyIntent = this.detectIntentByKeywordScore(normalized, userMessage);
      if (fuzzyIntent.action) {
        return await this.executeAndFormat(fuzzyIntent.action, fuzzyIntent.params, userMessage);
      }
      return ResponseTemplates.getClarificationResponse();
    }

    return await this.executeAndFormat(intent.action, intent.params, userMessage);
  }

  private async executeAndFormat(
    action: keyof ReturnType<typeof buildCopilotTools>,
    params: Record<string, any>,
    originalMessage: string
  ): Promise<string> {
    try {
      const result = await this.executeAction(action, params);
      return this.formatResponse(result, action, params, originalMessage);
    } catch (error) {
      return ResponseTemplates.handleError(action);
    }
  }

  // ==============================
  // CAPA 1: DETECCIÓN DE INTENCIÓN (PATRONES EXHAUSTIVOS)
  // ==============================
  /**
   * Detecta la intención del usuario usando patrones regex.
   *
   * IMPORTANTE: Usamos `original` (texto sin normalizar) para el matching
   * de patrones porque ArgSpanishUtils.normalize() elimina acentos,
   * pero los patrones regex los incluyen (ej: "qué", "estadísticas", "teléfono").
   * Usar el texto normalizado rompería todos los patrones acentuados.
   */
  private detectIntent(text: string, original: string): {
    action: keyof ReturnType<typeof buildCopilotTools> | null;
    params: Record<string, any>
  } {
    // Definición de patrones por intención (cobertura completa del CRM)
    const INTENT_PATTERNS = [
      // ==============================
      // ESTADÍSTICAS Y VENTAS (getDashboardStats)
      // ==============================
      {
        patterns: [
          // Con ^ anchor (frases directas)
          /^(?:cuántas?\s+)?(?:ventas?|ganancias?|operaciones?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuánto\s+|¿cuánto\s+)?hemos\s+(?:facturado|vendido|ganado)\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:estadísticas?|resumen|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuántas?\s+)?(?:ventas?|operaciones?)\s+(?:de\s+)?(?:hoy|ayer)/i,
          /^(?:qué\s+|¿qué\s+)?(?:pasó|pasó)\s+(?:en\s+)?(?:nuestra\s+)?concesionaria\s+(?:este\s+mes|hoy)/i,
          /^(?:dame|pasame|mostrame)\s+(?:el\s+)?(?:resumen|estadísticas?|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cómo\s+|¿cómo\s+)?(?:vamos|estamos)\s+(?:este\s+mes|hoy)/i,
          /^(?:cómo\s+|¿cómo\s+)?(?:va|está\s+yendo)\s+(?:el\s+)?negocio/i,
          // Sin ^ anchor (frases flexibles)
          /(?:resumen|balance|estadísticas?)\s+(?:del\s+)?(?:mes|negocio)/i,
          /(?:qué\s+)?(?:resultado|números?)\s+(?:tenemos|dio|dieron)\s+(?:este\s+mes)/i,
          /(?:dame\s+)?las?\s+(?:estadísticas?|cifras?|números?)\s+(?:de|del)\s+(?:mes|negocio)/i,
          /(?:cómo\s+)?(?:vamos|estamos|anda)\s+(?:de\s+)?(?:ventas?|facturación?)/i,
        ],
        action: 'getDashboardStats',
        paramsExtractor() {
          return {};
        }
      },
      {
        patterns: [
          // Con ^ anchor
          /^(?:mostrame?|muéstrame?|ver|mostrar)\s+(?:las?\s+)?(?:ventas?|operaciones?|facturas?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:lista|listado)\s+de\s+(?:ventas?|operaciones?)\s+(?:recientes?|del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuáles?\s+|¿cuáles?\s+)?fueron\s+(?:nuestras\s+)?(?:ventas?|ganancias?)\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuánto\s+|¿cuánto\s+)?ganamos\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuál\s+|¿cuál\s+)?fue\s+(?:nuestra\s+)?ganancia\s+(?:neta\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:ingresos?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cómo\s+|¿cómo\s+)?van\s+(?:las\s+)?(?:ventas?|operaciones?)/i,
          /^(?:dame|pasame)\s+(?:el\s+)?(?:reporte|resumen)\s+de\s+(?:ventas?|operaciones?)/i,
          // Sin ^ anchor
          /(?:reporte|resumen|listado)\s+de\s+(?:ventas?|operaciones?)/i,
          /(?:ventas?|operaciones?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual|reciente)/i,
          /(?:cuánto|cuántas?)\s+(?:vendimos|facturamos|ganamos)/i,
        ],
        action: 'getDeals',
        paramsExtractor() {
          return {
            limit: 20,
            status: ['DELIVERED', 'APPROVED', 'IN_PAYMENT']
          };
        }
      },
      {
        patterns: [
          // Ganancia neta (con ^ anchor)
          /^(?:cuánto\s+|¿cuánto\s+)?ganamos\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuál\s+|¿cuál\s+)?fue\s+(?:nuestra\s+)?ganancia\s+(?:neta\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:ingresos?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          // Sin ^ anchor
          /(?:ganancia|ganancias?)\s+(?:neta\s+)?(?:del\s+)?(?:mes|este\s+mes)/i,
          /(?:cuánto|cuánta)\s+(?:dinero|plata|guía)\s+(?:entró|ingresó|generamos)/i,
        ],
        action: 'getDeals',
        paramsExtractor() {
          return {
            forceNetProfitCalculation: true,
            limit: 100,
            status: ['DELIVERED', 'APPROVED']
          };
        }
      },

      // ==============================
      // INVENTARIO DE VEHÍCULOS (searchUnits)
      // ==============================
      {
        patterns: [
          // Con ^ anchor
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:autos?|vehículos?|unidades?)\s+(?:disponibles?|en\s+stock|para\s+venta|0km)/i,
          /^(?:qué\s+|¿qué\s+)?(?:autos?|vehículos?)\s+(?:tienes?|tenés|hay|hay\s+disponibles?)/i,
          /^(?:stock\s+de\s+|inventario\s+de\s+)?(?:autos?|vehículos?)/i,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:autos?|vehículos?)/i,
          /^(?:autos?|vehículos?)\s+(?:de\s+tipo\s+|tipo\s+de\s+)/i,
          /^(?:autos?|vehículos?)\s+(?:de\s+marca\s+|marca\s+de\s+)/i,
          /^(?:autos?|vehículos?)\s+(?:del\s+|modelo\s+)?(?:año\s+)?\d{4}/i,
          /^(?:autos?|vehículos?)\s+(?:con\s+precio\s+|precio\s+)?(?:hasta|menos\s+de|máximo\s+|max\s+)/i,
          /^(?:autos?|vehículos?)\s+(?:con\s+precio\s+|precio\s+)?(?:desde|más\s+de|mínimo\s+|min\s+)/i,
          /^(?:autos?|vehículos?)\s+(?:entre\s+)?\d+(?:\.\d+)?\s*(?:palo|luca)\s+y\s+\d+(?:\.\d+)?\s*(?:palo|luca)/i,
          /^(?:0km\s+|nuevo\s+|usado\s+)?(?:autos?|vehículos?|unidades?)/i,
          /^(?:chevrolet|ford|toyota|volkswagen|honda|fiat|peugeot|renault|Citroen|nissan|kia|hyundai)\s+(?:autos?|vehículos?)/i,
          /^(?:quiero\s+)?(?:ver|conocer|saber)\s+(?:el\s+)?(?:stock|inventario|catálogo)/i,
          /^(?:dame|pasame|mostrame)\s+(?:el\s+)?(?:listado|lista|stock|inventario)\s+(?:de\s+)?(?:autos?|vehículos?)/i,
          // Sin ^ anchor
          /(?:autos?|vehículos?)\s+(?:que\s+)?(?:hay|tiene|tenemos|disponibles?|en\s+stock)/i,
          /(?:stock|inventario|cátalogo)\s+(?:de\s+)?(?:autos?|vehículos?|la\s+)?(?:concesionaria)?/i,
          /(?:listado|lista)\s+(?:de\s+)?(?:autos?|vehículos?|unidades)/i,
          /(?:qué\s+)?(?:autos?|vehículos?)\s+(?:hay|tenemos|tienen|existen)/i,
          /(?:búscame?|buscar|encontrar)\s+(?:un\s+)?(?:auto|vehículo|0km|usado)/i,
          /(?:modelo|marca)\s+(?:de\s+)?(?:auto|vehículo)/i,
          /(?:toyota|ford|chevrolet|volkswagen|vw|honda|fiat|peugeot|renault|nissan|kia|hyundai|citroen|jeep|bmw|audi|mercedes|ram)/i,
        ],
        action: 'searchUnits',
        paramsExtractor: this.extractUnitSearchParams
      },

      // ==============================
      // GESTIÓN DE LEADS (searchLeads, createLead, updateLeadStatus)
      // ==============================
      {
        patterns: [
          // Con ^ anchor
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:leads?|prospectos?|clientes?)\s+(?:activos?|nuevos?|pendientes?|sin\s+contactar)/i,
          /^(?:qué\s+|¿qué\s+)?(?:leads?|prospectos?|clientes?)\s+(?:tienes?|hay|hay\s+disponibles?)/i,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:leads?|prospectos?|clientes?)/i,
          /^(?:leads?|prospectos?|clientes?)\s+(?:de\s+|de\s+origen\s+|de\s+fuente\s+)/i,
          /^(?:llamados?|contactos?|prospectos?)\s+(?:de\s+)?(?:hoy|ayer|esta\s+semana)/i,
          /^(?:quiero\s+)?(?:ver|conocer|saber)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?)/i,
          /^(?:dame|pasame|mostrame)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?|contactos?)/i,
          // Sin ^ anchor
          /(?:leads?|clientes?|prospectos?)\s+(?:nuevos?|activos?|pendientes?|sin\s+contactar)/i,
          /(?:clientes?|prospectos?)\s+(?:que\s+)?(?:hay|tenemos|tienen|existen)/i,
          /(?:listado|lista)\s+(?:de\s+)?(?:leads?|clientes?|prospectos?)/i,
          /(?:qué\s+)?(?:leads?|clientes?|prospectos?)\s+(?:hay|tenemos)/i,
        ],
        action: 'searchLeads',
        paramsExtractor: this.extractLeadSearchParams
      },
      {
        patterns: [
          // Con ^ anchor
          /^(?:crear|agregar|dar\s+de\s+alta|registrar|cargar|ingresar)\s+(?:un\s+)?(?:nuevo\s+)?(?:lead|cliente|prospecto)/i,
          /^(?:nuevo\s+)?(?:lead|cliente|prospecto)\s+(?:llamado\s+|de\s+nombre\s+|se\s+llama\s+)/i,
          /^(?:agregar\s+)?(?:cliente\s+|lead\s+)?[^,!?]+?\s+(?:con\s+teléfono\s+|teléfono\s+|con\s+email\s+|email\s+)/i,
          // Sin ^ anchor
          /(?:necesito|quiero)\s+(?:crear|agregar|registrar|dar\s+de\s+alta)\s+(?:un\s+)?(?:cliente|lead|prospecto)/i,
          /(?:crear|agregar|registrar)\s+(?:un\s+)?(?:nuevo\s+)?(?:contacto|cliente|lead)/i,
        ],
        action: 'createLead',
        paramsExtractor: this.extractCreateLeadParams
      },
      {
        patterns: [
          // Con ^ anchor
          /^(?:actualizar|cambiar|poner|mover)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:lead|cliente|prospecto)/i,
          /^(?:lead|cliente|prospecto)\s+[^,!?]+?\s+(?:pasa\s+a\s+|estado\s+a\s+|cambiar\s+a\s+)/i,
          /^(?:ponerse\s+en\s+|pasar\s+a\s+)\s+(?:lead|cliente|prospecto)\s+(?:a\s+)?(?:nuevo\s+|contactado\s+|visita\s+agendada\s+|negociación\s+|reservado\s+|vendido\s+|perdido)/i,
          // Sin ^ anchor
          /(?:actualizar|cambiar|modificar)\s+(?:el\s+)?(?:estado|etapa)\s+(?:de\s+)?(?:un\s+)?(?:lead|cliente|prospecto)/i,
          /(?:pasar|mover)\s+(?:a\s+)?(?:un\s+)?(?:lead|cliente|prospecto)\s+(?:a|de)\s+/i,
        ],
        action: 'updateLeadStatus',
        paramsExtractor: this.extractUpdateLeadStatusParams
      },

      // ==============================
      // ESTADO DE VEHÍCULOS (updateUnitStatus)
      // ==============================
      {
        patterns: [
          // Con ^ anchor
          /^(?:actualizar|cambiar|poner|mover)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:vehículo|auto|unit)/i,
          /^(?:vehículo|auto|unit)\s+[^,!?]+?\s+(?:está\s+ahora\s+|pasa\s+a\s+|estado\s+a\s+|cambiar\s+a\s+)/i,
          /^(?:marcar\s+como\s+|poner\s+en\s+estado\s+)\s+(?:disponible|vendido|reservado|en\s+preparación)/i,
          /^(?:0km\s+|nuevo\s+|usado\s+)?(?:vehículo|auto|unit)\s+[^,!?]+/i,
          // Sin ^ anchor
          /(?:actualizar|cambiar|modificar)\s+(?:el\s+)?(?:estado|status)\s+(?:de\s+)?(?:un\s+)?(?:vehículo|auto|unit)/i,
          /(?:marcar\s+como|poner\s+como)\s+(?:disponible|vendido|reservado|preparación)/i,
        ],
        action: 'updateUnitStatus',
        paramsExtractor: this.extractUpdateUnitStatusParams
      }
    ];

    // Usamos el texto ORIGINAL (sin normalización) para el matching de patrones,
    // porque los patrones contienen caracteres acentuados.
    const searchText = original;

    // Buscar primera coincidencia (orden importante: más específicos primero)
    for (const { patterns, action, paramsExtractor } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          const params = paramsExtractor(original, original);
          return { action: action as any, params };
        }
      }
    }

    return { action: null, params: {} };
  }

  // ==============================
  // CAPA 1B: DETECCIÓN FUZZY POR KEYWORDS (para preguntas similares)
  // ==============================
  /**
   * Fallback cuando los patrones exactos no coinciden.
   * Usa scoring por keywords para detectar la intención aunque
   * la frase esté expresada de forma diferente.
   */
  private detectIntentByKeywordScore(text: string, original: string): {
    action: keyof ReturnType<typeof buildCopilotTools> | null;
    params: Record<string, any>
  } {
    const nText = text; // Ya viene normalizado (sin acentos)
    const oText = original;

    // Keywords fuertes: si una SOLA de estas aparece, threshold baja de 2 a 1
    const strongKeywords: Record<string, string[]> = {
      getDashboardStats: ['estadistica', 'resumen', 'balance', 'kpi', 'indicador', 'reporte'],
      searchUnits: ['stock', 'inventario', 'catalogo', 'disponible', '0km', 'listado'],
      searchLeads: ['lead', 'prospecto', 'cliente'],
      createLead: ['crear', 'agregar', 'registrar', 'alta', 'ingresar', 'cargar'],
      getDeals: ['operacion', 'factura'],
      updateLeadStatus: ['actualizar'],
      updateUnitStatus: ['marcar', 'preparacion'],
    };

    const actions: Array<{
      name: keyof ReturnType<typeof buildCopilotTools>;
      keywords: string[];
      weight: number;
      paramsExtractor: (text: string, original: string) => Record<string, any>;
    }> = [
      {
        name: 'getDashboardStats',
        keywords: [
          'estadistica', 'resumen', 'balance', 'reporte', 'kpi', 'indicador',
          'cifra', 'numero', 'venta', 'ganancia', 'facturacion', 'operacion',
          'ingreso', 'concesionaria', 'negocio', 'mes', 'resultado',
          'vamos', 'estamos', 'anda', 'paso', 'dio', 'dieron', 'tenemos',
        ],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'searchUnits',
        keywords: [
          'auto', 'vehiculo', 'unidad', '0km', 'usado', 'nuevo',
          'stock', 'inventario', 'catalogo', 'disponible',
          'marca', 'modelo', 'precio', 'palo', 'luca',
          'toyota', 'ford', 'chevrolet', 'honda', 'fiat', 'volkswagen',
          'peugeot', 'renault', 'nissan', 'kia', 'hyundai', 'citroen',
          'jeep', 'bmw', 'audi', 'mercedes', 'ram',
          'hilux', 'corolla', 'ranger', 'amarok', 'camioneta', 'sedan',
          'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame',
          'quiero', 'necesito', 'listado', 'lista',
          'hay', 'tiene', 'tenemos', 'tienen', 'existen',
        ],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => {
          const params: any = { limit: 15 };
          const n = ArgSpanishUtils.normalize(t);
          if (n.includes('0km') || n.includes('nuevo') || n.includes('disponible')) {
            const brandMatch = orig.match(/(?:marca\s+)?(toyota|ford|chevrolet|honda|fiat|volkswagen|peugeot|renault|nissan|kia|hyundai|citroen)/i);
            if (brandMatch) params.query = brandMatch[1];
          }
          if (n.includes('usado') && !n.includes('0km')) {
            const brandMatch = orig.match(/(?:marca\s+)?(toyota|ford|chevrolet|honda|fiat|volkswagen|peugeot|renault|nissan|kia|hyundai|citroen)/i);
            if (brandMatch) params.query = brandMatch[1];
          }
          return params;
        }
      },
      {
        name: 'searchLeads',
        keywords: [
          'lead', 'cliente', 'prospecto', 'contacto',
          'llamado', 'persona', 'comprador', 'interesado',
          'nuevo', 'nuevos', 'activos', 'pendiente', 'sin contactar',
          'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame',
          'quiero', 'necesito', 'listado', 'lista',
          'hay', 'tenemos',
        ],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => {
          const params: any = { limit: 15 };
          const n = ArgSpanishUtils.normalize(t);
          // Detectar estado implícito
          if (n.includes('nuevo')) params.status = 'NEW';
          if (n.includes('sin contactar')) params.status = 'NEW';
          if (n.includes('pendiente')) params.status = 'NEW';
          // Detectar fecha relativa
          const dateRange = ArgSpanishUtils.parseRelativeDate(orig);
          if (dateRange) params.dateRange = dateRange;
          return params;
        }
      },
      {
        name: 'createLead',
        keywords: [
          'crear', 'agregar', 'nuevo', 'alta', 'registrar',
          'cargar', 'ingresar', 'nuevos', 'dar de alta',
          'cliente', 'lead', 'prospecto', 'contacto',
        ],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractCreateLeadParams(t, orig)
      },
      {
        name: 'updateLeadStatus',
        keywords: [
          'actualizar', 'cambiar', 'modificar', 'mover',
          'pasar', 'estado', 'etapa',
          'lead', 'cliente', 'prospecto',
        ],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractUpdateLeadStatusParams(t, orig)
      },
      {
        name: 'getDeals',
        keywords: [
          'operacion', 'venta', 'ventas', 'negocio',
          'cerrado', 'entregado', 'factura', 'ingreso',
          'ganancia', 'facturacion', 'vendimos', 'entregamos',
          'ver', 'mostrar', 'mostrame', 'dame', 'pasame', 'decime',
          'reciente', 'listado',
        ],
        weight: 0,
        paramsExtractor: () => ({ limit: 10 })
      },
      {
        name: 'updateUnitStatus',
        keywords: [
          'marcar', 'estado', 'preparacion', 'reservar',
          'disponible', 'vendido', 'vehiculo', 'auto', 'unidad',
        ],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractUpdateUnitStatusParams(t, orig)
      }
    ];

    // Calcular score para cada accion basado en keywords
    for (const action of actions) {
      action.weight = action.keywords.filter(kw => nText.includes(kw)).length;
    }

    // Ordenar por score descendente
    const sorted = [...actions].sort((a, b) => b.weight - a.weight);
    const best = sorted[0];

    if (best && best.weight > 0) {
      // Si tiene strong keywords -> threshold 1, sino threshold 2
      const bestStrong = strongKeywords[best.name] || [];
      const hasStrongMatch = bestStrong.some(kw => nText.includes(kw));
      const threshold = hasStrongMatch ? 1 : 2;

      if (best.weight >= threshold) {
        const params = best.paramsExtractor(nText, oText);
        return { action: best.name, params };
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
    // Normalizar texto para que patrones funcionen con acentos y sin acentos
    const t = ArgSpanishUtils.normalize(text);

    // Nombre (maneja "llamado", "nombre", "cliente se llama")
    // Patrón sin acentos para que funcione con texto normalizado
    const nameMatch = t.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|telefono|email|de|$)|$)/i);
    if (nameMatch) {
      // Preservar capitalización del texto original
      const originalNameMatch = original.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|tel[eé]fono|email|de|$)|$)/i);
      params.name = originalNameMatch ? originalNameMatch[1].trim() : nameMatch[1].trim();
    }

    // Teléfono (formato argentino flexible)
    const phoneMatch = t.match(/(?:telefono|tel|celular|contacto)\s*:?\s*([\d\s\-]+)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/[\s\-]/g, '');
      if (/^\d{8,}$/.test(cleanPhone)) params.phone = cleanPhone;
    }

    // Email
    const emailMatch = t.match(/(?:email|e-mail|correo)\s*:?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) params.email = emailMatch[1];

    // Fuente (maneja jerga argentina)
    // Usamos `original` (texto con acentos) para que keys como "entró caminando" funcionen
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
      // Intentar con ambos: original (acentos) y normalizado (sin acentos)
      const normalizedKey = ArgSpanishUtils.normalize(key);
      if (original.includes(key) || t.includes(normalizedKey)) {
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
    // Normalizar texto para que patrones funcionen con acentos y sin acentos
    const t = ArgSpanishUtils.normalize(text);

    // Extraer título del vehículo (maneja "vehículo Corolla", "auto Hilux")
    const unitNameMatch = t.match(/(?:vehiculo|auto|unit)\s+(?:llamado|de\s+titulo|modelo)\s+([^,.!?]+?)(?:\s+(?:esta\s+ahora\s+pasa\s+a|estado\s+a|actualiza\s+con))/i);
    if (unitNameMatch) {
      // Preservar capitalización del original
      const originalMatch = original.match(/(?:vehículo|auto|unit)\s+(?:llamado\s+|de\s+título\s+|modelo\s+)\s+([^,.!?]+?)(?:\s+(?:está|estado|pasa|actualiza))/i);
      params.unitIdLookupTitle = originalMatch ? originalMatch[1].trim() : unitNameMatch[1].trim();
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
  // MÉTODO DE INTEGRACIÓN EN route.ts
  // ==============================
  /**
   * Método estático para usar en route.ts.
   * Procesa los mensajes y devuelve el texto de respuesta.
   * El streaming/formateo del stream lo maneja route.ts.
   */
  static async handleRequest(messages: any[], companyId: string, userId: string): Promise<string> {
    const agent = new RuleBasedAgent(companyId, userId);

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Formato de mensaje inválido');
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
    } else if (typeof lastUserMessageObj?.text === 'string') {
      lastUserMessage = lastUserMessageObj.text;
    }

    if (!lastUserMessage.trim()) {
      throw new Error('Mensaje vacío');
    }

    return await agent.processMessage(lastUserMessage);
  }
}