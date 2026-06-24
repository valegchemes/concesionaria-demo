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

  async processMessage(userMessage: string): Promise<string> {
    const normalized = ArgSpanishUtils.normalize(userMessage);

    // Capa 0: conversacionales (saludo, gracias, ayuda, despedida).
    // Se detectan antes que cualquier intent de BD porque son frases cortas
    // que fácilmente podrían matchear keywords fuzzy por error.
    const conversational = this.detectConversational(userMessage, normalized);
    if (conversational) return conversational;

    const intent = this.detectIntent(normalized, userMessage);
    if (!intent.action) {
      const fuzzyIntent = this.detectIntentByKeywordScore(normalized, userMessage);
      if (fuzzyIntent.action) return await this.executeAndFormat(fuzzyIntent.action, fuzzyIntent.params, userMessage);
      return ResponseTemplates.getClarificationResponse();
    }
    return await this.executeAndFormat(intent.action, intent.params, userMessage);
  }

  /**
   * Capa 0: detecta mensajes conversacionales comunes (saludos, agradecimientos,
   * pedidos de ayuda, despedidas). Retorna la respuesta inmediata o null si no
   * corresponde. Esto reduce los falsos "No entendí" en interacciones cotidianas.
   */
  private detectConversational(original: string, normalized: string): string | null {
    const t = normalized.trim();

    // Saludos: "hola", "buenas", "qué tal", "buen día", "buenas tardes", etc.
    // Solo al inicio o como frase corta (evita matchear "hola, busco un toyota").
    if (/^(?:hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches|que\s+tal|holi|hey)\b/i.test(original.trim()) && original.trim().length < 30) {
      return ResponseTemplates.getGreetingResponse();
    }

    // Agradecimientos (frase corta, no "gracias a este cliente compró...")
    if ((/^gracias\b/i.test(t) || /\b(?:muchas\s+gracias|mil\s+gracias)\b/i.test(t)) && t.length < 40) {
      return ResponseTemplates.getThanksResponse();
    }
    if (/^(?:perfecto|genial|excelente|buenisimo|barbaro|dale)\b/i.test(t) && t.length < 25) {
      return ResponseTemplates.getThanksResponse();
    }

    // Despedidas
    if (/\b(?:chau|chao|adios|nos\s+vemos|hasta\s+luego|hasta\s+manana|me\s+voy)\b/i.test(t) && t.length < 40) {
      return ResponseTemplates.getFarewellResponse();
    }

    // Pedidos de ayuda / qué podés hacer / quién sos
    if (/\b(?:que\s+podes\s+hacer|que\s+sabes\s+hacer|ayuda|como\s+funcionas|menu|opciones|comandos|quien\s+sos|ayudame|para\s+que\s+servis)\b/i.test(t)) {
      return ResponseTemplates.getCapabilitiesResponse();
    }

    return null;
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
      return ResponseTemplates.handleError(action as string);
    }
  }

  // ==============================
  // CAPA 1: DETECCIÓN DE INTENCIÓN
  // ==============================
  private detectIntent(text: string, original: string): {
    action: keyof ReturnType<typeof buildCopilotTools> | null;
    params: Record<string, any>
  } {
    const INTENT_PATTERNS = [
      // ─── DASHBOARD ───
      {
        patterns: [
          /^(?:cuántas?\s+)?(?:ventas?|ganancias?|operaciones?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuánto\s+|¿cuánto\s+)?hemos\s+(?:facturado|vendido|ganado)\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:estadísticas?|resumen|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuántas?\s+)?(?:ventas?|operaciones?)\s+(?:de\s+)?(?:hoy|ayer)/i,
          /^(?:dame|pasame|mostrame)\s+(?:el\s+)?(?:resumen|estadísticas?|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cómo\s+|¿cómo\s+)?(?:vamos|estamos)\s+(?:este\s+mes|hoy)/i,
          /^(?:cómo\s+|¿cómo\s+)?(?:va|está\s+yendo)\s+(?:el\s+)?negocio/i,
          /(?:resumen|balance|estadísticas?)\s+(?:del\s+)?(?:mes|negocio)/i,
          /(?:dame\s+)?las?\s+(?:estadísticas?|cifras?|números?)\s+(?:de|del)\s+(?:mes|negocio)/i,
          /(?:cómo\s+)?(?:vamos|estamos|anda)\s+(?:de\s+)?(?:ventas?|facturación?)/i,
        ],
        action: 'getDashboardStats',
        paramsExtractor: () => ({})
      },

      // ─── OPERACIONES ───
      {
        patterns: [
          /^(?:mostrame?|muéstrame?|ver|mostrar)\s+(?:las?\s+)?(?:ventas?|operaciones?|facturas?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:lista|listado)\s+de\s+(?:ventas?|operaciones?)\s+(?:recientes?|del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuáles?\s+|¿cuáles?\s+)?fueron\s+(?:nuestras\s+)?(?:ventas?|ganancias?)\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:cómo\s+|¿cómo\s+)?van\s+(?:las\s+)?(?:ventas?|operaciones?)/i,
          /^(?:dame|pasame)\s+(?:el\s+)?(?:reporte|resumen)\s+de\s+(?:ventas?|operaciones?)/i,
          /(?:reporte|resumen|listado)\s+de\s+(?:ventas?|operaciones?)/i,
          /(?:ventas?|operaciones?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual|reciente)/i,
          /(?:cuánto|cuántas?)\s+(?:vendimos|facturamos|ganamos)/i,
        ],
        action: 'getDeals',
        paramsExtractor: () => ({ limit: 10 })
      },

      // ─── GANANCIA NETA ───
      {
        patterns: [
          /^(?:cuánto\s+|¿cuánto\s+)?ganamos\s+(?:este\s+mes|mes\s+actual)/i,
          /^(?:cuál\s+|¿cuál\s+)?fue\s+(?:nuestra\s+)?ganancia\s+(?:neta\s+)?(?:este\s+mes|mes\s+actual)/i,
          /^(?:ingresos?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
          /(?:ganancia|ganancias?)\s+(?:neta\s+)?(?:del\s+)?(?:mes|este\s+mes)/i,
          /(?:cuánto|cuánta)\s+(?:dinero|plata|guía)\s+(?:entró|ingresó|generamos)\s+(?:este\s+mes|este\s+)/i,
        ],
        action: 'getNetProfit',
        paramsExtractor: () => ({})
      },

      // ─── GASTOS ───
      {
        patterns: [
          /^(?:cuáles?\s+son\s+|mostrame|dame|pasame)\s+(?:los\s+)?(?:gastos?|costos?|egresos?)\s+(?:del\s+)?(?:mes|este\s+mes|período)/i,
          /^(?:gastos?|costos?|egresos?)\s+(?:mensuales?|operativos?|del\s+mes)/i,
          /^(?:cuánto\s+|¿cuánto\s+)?(?:gastamos|hemos\s+gastado)\s+(?:este\s+mes|mes\s+actual)/i,
          /(?:gastos?|costos?)\s+(?:de\s+)?(?:este\s+)?(?:mes|período)/i,
          /(?:cuánto\s+)?(?:gastamos|gastó)\s+(?:el\s+)?(?:negocio|mes)/i,
        ],
        action: 'getCompanyExpenses',
        paramsExtractor: () => ({})
      },

      // ─── INVENTARIO / VEHÍCULOS ───
      {
        patterns: [
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:autos?|vehículos?|unidades?)\s+(?:disponibles?|en\s+stock|para\s+venta|0km)/i,
          /^(?:qué\s+|¿qué\s+)?(?:autos?|vehículos?)\s+(?:tienes?|tenés|hay|hay\s+disponibles?)/i,
          /^(?:stock\s+de\s+|inventario\s+de\s+)?(?:autos?|vehículos?)/i,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:autos?|vehículos?)/i,
          /^(?:quiero\s+)?(?:ver|conocer|saber)\s+(?:el\s+)?(?:stock|inventario|catálogo)/i,
          /^(?:dame|pasame|mostrame)\s+(?:el\s+)?(?:listado|lista|stock|inventario)\s+(?:de\s+)?(?:autos?|vehículos?)/i,
          /(?:autos?|vehículos?)\s+(?:que\s+)?(?:hay|tiene|tenemos|disponibles?|en\s+stock)/i,
          /(?:stock|inventario|cátalogo)\s+(?:de\s+)?(?:autos?|vehículos?|la\s+)?(?:concesionaria)?/i,
          /(?:listado|lista)\s+(?:de\s+)?(?:autos?|vehículos?|unidades)/i,
          /(?:qué\s+)?(?:autos?|vehículos?)\s+(?:hay|tenemos|tienen|existen)/i,
          /(?:búscame?|buscar|encontrar)\s+(?:un\s+)?(?:auto|vehículo|0km|usado)/i,
          /(?:toyota|ford|chevrolet|volkswagen|vw|honda|fiat|peugeot|renault|nissan|kia|hyundai|citroen|jeep|bmw|audi|mercedes|ram)/i,
        ],
        action: 'searchUnits',
        paramsExtractor: this.extractUnitSearchParams
      },

      // ─── FINANZAS DE VEHÍCULO ───
      {
        patterns: [
          /^(?:costos?|finanzas?|margen|precios?)\s+(?:de[l]?\s+)?(?:vehículo|auto|unidad|0km)/i,
          /^(?:cuánto\s+)?(?:cuesta|cuestan)\s+(?:los\s+)?(?:costos?|gastos?)\s+(?:de[l]?\s+)?(?:vehículo|auto)/i,
          /^(?:desglose|detalle|análisis)\s+(?:de\s+)?(?:costos?|finanzas?)\s+(?:de[l]?\s+)?(?:vehículo|auto)/i,
          /(?:costos?|finanzas?)\s+(?:de\s+)?(?:vehículo|auto|unidad)/i,
          /(?:cuánto\s+)?(?:cuesta|costó|sale)\s+(?:mantener|preparar|arreglar)\s+(?:el\s+)?(?:auto|vehículo)/i,
          /(?:margen\s+)?(?:de\s+)?(?:ganancia|utilidad)\s+(?:de[l]?\s+)?(?:vehículo|auto)/i,
        ],
        action: 'getUnitFinances',
        paramsExtractor: this.extractUnitFinanceParams
      },

      // ─── LEADS ───
      {
        patterns: [
          /^(?:cuántos?\s+|¿cuántos?\s+)?(?:leads?|prospectos?|clientes?)\s+(?:activos?|nuevos?|pendientes?|sin\s+contactar)/i,
          /^(?:qué\s+|¿qué\s+)?(?:leads?|prospectos?|clientes?)\s+(?:tienes?|hay|hay\s+disponibles?)/i,
          /^(?:buscar|mostrame?|muéstrame?)\s+(?:leads?|prospectos?|clientes?)/i,
          /^(?:quiero\s+)?(?:ver|conocer|saber)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?)/i,
          /^(?:dame|pasame|mostrame)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?|contactos?)/i,
          /(?:leads?|clientes?|prospectos?)\s+(?:nuevos?|activos?|pendientes?|sin\s+contactar)/i,
          /(?:clientes?|prospectos?)\s+(?:que\s+)?(?:hay|tenemos|tienen|existen)/i,
          /(?:listado|lista)\s+(?:de\s+)?(?:leads?|clientes?|prospectos?)/i,
          /(?:qué\s+)?(?:leads?|clientes?|prospectos?)\s+(?:hay|tenemos)/i,
        ],
        action: 'searchLeads',
        paramsExtractor: this.extractLeadSearchParams
      },

      // ─── CREAR LEAD ───
      {
        patterns: [
          /^(?:crear|agregar|dar\s+de\s+alta|registrar|cargar|ingresar)\s+(?:un\s+)?(?:nuevo\s+)?(?:lead|cliente|prospecto)/i,
          /^(?:nuevo\s+)?(?:lead|cliente|prospecto)\s+(?:llamado\s+|de\s+nombre\s+|se\s+llama\s+)/i,
          /(?:necesito|quiero)\s+(?:crear|agregar|registrar|dar\s+de\s+alta)\s+(?:un\s+)?(?:cliente|lead|prospecto)/i,
          /(?:crear|agregar|registrar)\s+(?:un\s+)?(?:nuevo\s+)?(?:contacto|cliente|lead)/i,
        ],
        action: 'createLead',
        paramsExtractor: this.extractCreateLeadParams
      },

      // ─── ACTUALIZAR LEAD ───
      {
        patterns: [
          /^(?:actualizar|cambiar|poner|mover)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:lead|cliente|prospecto)/i,
          /^(?:lead|cliente|prospecto)\s+[^,!?]+?\s+(?:pasa\s+a\s+|estado\s+a\s+|cambiar\s+a\s+)/i,
          /^(?:ponerse\s+en\s+|pasar\s+a\s+)\s+(?:lead|cliente|prospecto)\s+(?:a\s+)?(?:nuevo|contactado|visita|negociación|reservado|vendido|perdido)/i,
          /(?:actualizar|cambiar|modificar)\s+(?:el\s+)?(?:estado|etapa)\s+(?:de\s+)?(?:un\s+)?(?:lead|cliente|prospecto)/i,
        ],
        action: 'updateLeadStatus',
        paramsExtractor: this.extractUpdateLeadStatusParams
      },

      // ─── ACTUALIZAR VEHÍCULO ───
      {
        patterns: [
          /^(?:actualizar|cambiar|poner|mover)\s+(?:el\s+)?(?:estado\s+de\s+|de\s+)?(?:vehículo|auto|unit)/i,
          /^(?:marcar\s+como\s+|poner\s+en\s+estado\s+)\s+(?:disponible|vendido|reservado|en\s+preparación)/i,
          /(?:actualizar|cambiar|modificar)\s+(?:el\s+)?(?:estado|status)\s+(?:de\s+)?(?:un\s+)?(?:vehículo|auto|unit)/i,
          /(?:marcar\s+como|poner\s+como)\s+(?:disponible|vendido|reservado|preparación)/i,
        ],
        action: 'updateUnitStatus',
        paramsExtractor: this.extractUpdateUnitStatusParams
      },

      // ─── AUDITORÍAS ───
      {
        patterns: [
          /^(?:últimas?\s+|mostrame|dame|ver)\s+(?:auditorías?|audit\s+logs?|registros?\s+de\s+actividad|movimientos?)/i,
          /^(?:qué\s+|¿qué\s+)?(?:cambios?|modificaciones?|movimientos?)\s+(?:hubo|se\s+hicieron|hay)\s+(?:en\s+el\s+)?(?:sistema|último)/i,
          /^(?:actividad|historial)\s+(?:reciente|del\s+sistema|de\s+usuarios)/i,
          /(?:auditoría|audit\s+log|registro\s+de\s+actividad)/i,
          /(?:últimos?\s+)?(?:cambios?|modificaciones?)\s+(?:en\s+el\s+)?(?:sistema)/i,
          /(?:quién\s+|quien\s+)?(?:modificó|cambió|creó|eliminó)\s+/i,
        ],
        action: 'getAuditLogs',
        paramsExtractor: () => ({ limit: 10 })
      },

      // ─── CAJA ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|consultar)\s+(?:la\s+)?(?:caja|sesión\s+de\s+caja|estado\s+de\s+caja)/i,
          /^(?:cómo\s+está\s+|estado\s+de\s+)?(?:la\s+)?caja/i,
          /^(?:cuánto\s+)?(?:hay\s+en\s+)?(?:caja|efectivo)/i,
          /(?:caja|sesión)\s+(?:abierta|cerrada|actual)/i,
          /(?:balance|saldo)\s+(?:de\s+)?(?:caja|efectivo)/i,
        ],
        action: 'getCashSessions',
        paramsExtractor: () => ({})
      },

      // ─── TAREAS ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|listar)\s+(?:las?\s+)?(?:tareas?|pendientes?)/i,
          /^(?:qué\s+tareas?|tareas?\s+(?:pendientes?|asignadas?))\s+(?:hay|tenemos|tengo)/i,
          /^(?:tareas?\s+(?:de\s+)?(?:hoy|esta\s+semana|pendientes?))/i,
          /(?:tareas?)\s+(?:pendientes?|por\s+hacer|asignadas?)/i,
          /(?:qué\s+)?(?:hay\s+)?(?:pendiente|por\s+hacer)/i,
        ],
        action: 'getTasks',
        paramsExtractor: () => ({})
      },

      // ─── DOCUMENTOS ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|listar)\s+(?:los?\s+)?(?:documentos?|boletos?|recibos?|contratos?)/i,
          /^(?:documentos?\s+(?:generados?|pendientes?|firmados?))/i,
          /^(?:qué\s+)?(?:documentos?|boletos?|papeles?)\s+(?:hay|tenemos)/i,
          /(?:documentos?|boletos?)\s+(?:de\s+)?(?:compraventa|venta)/i,
        ],
        action: 'getDocuments',
        paramsExtractor: () => ({})
      },

      // ─── CUOTAS / PAGARÉS ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|listar)\s+(?:las?\s+)?(?:cuotas?|pagarés?|financiación|plan\s+de\s+pagos)/i,
          /^(?:cuotas?\s+(?:pendientes?|por\s+vencer|vencidas?))/i,
          /^(?:qué\s+)?(?:cuotas?|pagarés?)\s+(?:hay|tenemos|están)\s+(?:pendientes?|por\s+vencer)/i,
          /(?:cuotas?|pagarés?)\s+(?:pendientes?|vencidas?|por\s+vencer)/i,
          /(?:quiénes?\s+)?(?:deben|adeudan|tienen\s+cuotas?\s+pendientes?)/i,
        ],
        action: 'getInstallments',
        paramsExtractor: () => ({})
      },

      // ─── USUARIOS ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|listar)\s+(?:los?\s+)?(?:usuarios?|vendedores?|empleados?)/i,
          /^(?:quiénes?\s+son\s+|cuáles?\s+son\s+)?(?:los\s+)?(?:usuarios?|vendedores?)/i,
          /(?:usuarios?|empleados?|vendedores?)\s+(?:activos?|del\s+sistema)/i,
          /(?:lista|listado)\s+(?:de\s+)?(?:usuarios?|vendedores?)/i,
        ],
        action: 'getUsers',
        paramsExtractor: () => ({})
      },

      // ─── RANKING VENDEDORES ───
      {
        patterns: [
          /^(?:ranking|top|mejores)\s+(?:de\s+)?(?:vendedores?|vendedores?)/i,
          /^(?:quién\s+vendió\s+más|quiénes\s+vendieron\s+más)/i,
          /^(?:mejores?\s+)?(?:vendedores?\s+)?(?:del\s+mes|del\s+período)/i,
          /(?:ranking|top)\s+(?:de\s+)?(?:ventas?|vendedores?)/i,
          /(?:quién\s+)?(?:vendió\s+)?(?:más|mejor)/i,
        ],
        action: 'getTopSellers',
        paramsExtractor: () => ({})
      },

      // ─── ACTIVIDADES DE LEAD ───
      {
        patterns: [
          /^(?:mostrame|dame|ver|historial)\s+(?:las?\s+)?(?:actividades?|historial)\s+(?:de[l]?\s+)?(?:lead|cliente|prospecto)/i,
          /^(?:qué\s+)?(?:actividades?|movimientos?|seguimiento)\s+(?:tiene|hay|registró)\s+(?:el\s+)?(?:lead|cliente)/i,
          /(?:actividades?|historial)\s+(?:de\s+)?(?:seguimiento|lead|cliente)/i,
        ],
        action: 'getLeadActivities',
        paramsExtractor: this.extractLeadSearchParams
      },

      // ─── FINANZAS DE OPERACIÓN (DEAL) ───
      // Antes la tool getDealFinances existía pero no tenía intención asociada,
      // así que era inalcanzable desde el chat. Acepta ID (#1234 / op-1234)
      // o nombre del cliente ("finanzas de la operación de Juan").
      {
        patterns: [
          /^(?:finanzas?|detalle\s+financiero|desglose\s+financiero)\s+(?:de[l]?\s+)?(?:la\s+)?(?:operación|operacion|venta|deal)/i,
          /^(?:cuánto\s+se\s+pagó|saldo\s+(?:de|pendiente\s+de))\s+(?:la\s+)?(?:operación|operacion|venta)/i,
          /(?:finanzas?|detalle\s+financiero)\s+(?:de[l]?\s+)?(?:la\s+)?operación/i,
          /(?:finanzas?|detalle)\s+(?:de\s+)?(?:la\s+)?(?:operación|operacion)\s+#?[\w-]+/i,
          /operación\s+#?\w+\s+(?:finanzas?|detalle|saldo|pagos?)/i,
        ],
        action: 'getDealFinances',
        paramsExtractor: this.extractDealFinancesParams
      },
    ];

    const searchText = original;
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
  // CAPA 2: DETECCIÓN FUZZY POR KEYWORDS
  // ==============================
  private detectIntentByKeywordScore(text: string, original: string): {
    action: keyof ReturnType<typeof buildCopilotTools> | null;
    params: Record<string, any>
  } {
    const nText = text;
    const oText = original;

    const strongKeywords: Record<string, string[]> = {
      getDashboardStats: ['estadistica', 'resumen', 'balance', 'kpi', 'indicador', 'reporte'],
      searchUnits: ['stock', 'inventario', 'catalogo', 'disponible', '0km', 'listado'],
      searchLeads: ['lead', 'prospecto', 'cliente'],
      createLead: ['crear', 'agregar', 'registrar', 'alta', 'ingresar', 'cargar'],
      getDeals: ['operacion', 'factura'],
      updateLeadStatus: ['actualizar'],
      updateUnitStatus: ['marcar', 'preparacion'],
      getAuditLogs: ['auditoria', 'audit log', 'actividad sistema', 'cambios reciente', 'movimiento', 'modificacion'],
      getCompanyExpenses: ['gasto', 'costo', 'egreso', 'mensual'],
      getNetProfit: ['ganancia neta', 'ganancia neta', 'margen'],
      getCashSessions: ['caja', 'efectivo', 'balance caja'],
      getTasks: ['tarea', 'pendiente', 'por hacer'],
      getDocuments: ['documento', 'boleto', 'recibo', 'contrato'],
      getInstallments: ['cuota', 'pagare', 'financiacion', 'adeuda'],
      getUnitFinances: ['costo vehiculo', 'finanza vehiculo', 'margen auto'],
      getUsers: ['usuario', 'vendedor', 'empleado'],
      getTopSellers: ['ranking', 'top', 'mejor vendedor'],
      getDealFinances: ['finanza operacion', 'finanza deal', 'saldo pendiente', 'detalle financiero'],
    };

    const actions: Array<{
      name: keyof ReturnType<typeof buildCopilotTools>;
      keywords: string[];
      weight: number;
      paramsExtractor: (text: string, original: string) => Record<string, any>;
    }> = [
      {
        name: 'getDashboardStats',
        keywords: ['estadistica', 'resumen', 'balance', 'reporte', 'kpi', 'indicador', 'cifra', 'numero', 'venta', 'ganancia', 'facturacion', 'operacion', 'ingreso', 'concesionaria', 'negocio', 'mes', 'resultado', 'vamos', 'estamos', 'anda'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'searchUnits',
        keywords: ['auto', 'vehiculo', 'unidad', '0km', 'usado', 'nuevo', 'stock', 'inventario', 'catalogo', 'disponible', 'marca', 'modelo', 'precio', 'palo', 'luca', 'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame', 'quiero', 'necesito', 'listado', 'lista', 'hay', 'tiene', 'tenemos', 'tienen', 'existen'],
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
        keywords: ['lead', 'cliente', 'prospecto', 'contacto', 'llamado', 'persona', 'comprador', 'interesado', 'nuevo', 'activos', 'pendiente', 'sin contactar', 'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame', 'quiero', 'necesito', 'hay', 'tenemos'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => {
          const params: any = { limit: 15 };
          const n = ArgSpanishUtils.normalize(t);
          if (n.includes('nuevo')) params.status = 'NEW';
          if (n.includes('sin contactar')) params.status = 'NEW';
          if (n.includes('pendiente')) params.status = 'NEW';
          const dateRange = ArgSpanishUtils.parseRelativeDate(orig);
          if (dateRange) params.dateRange = dateRange;
          return params;
        }
      },
      {
        name: 'createLead',
        keywords: ['crear', 'agregar', 'nuevo', 'alta', 'registrar', 'cargar', 'ingresar', 'dar de alta', 'cliente', 'lead', 'prospecto', 'contacto'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractCreateLeadParams(t, orig)
      },
      {
        name: 'updateLeadStatus',
        keywords: ['actualizar', 'cambiar', 'modificar', 'mover', 'pasar', 'estado', 'etapa', 'lead', 'cliente', 'prospecto'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractUpdateLeadStatusParams(t, orig)
      },
      {
        name: 'getDeals',
        keywords: ['operacion', 'venta', 'ventas', 'negocio', 'cerrado', 'entregado', 'factura', 'ingreso', 'ganancia', 'facturacion', 'vendimos', 'entregamos', 'ver', 'mostrar', 'mostrame', 'dame', 'pasame', 'decime', 'reciente', 'listado'],
        weight: 0,
        paramsExtractor: () => ({ limit: 10 })
      },
      {
        name: 'updateUnitStatus',
        keywords: ['marcar', 'estado', 'preparacion', 'reservar', 'disponible', 'vendido', 'vehiculo', 'auto', 'unidad'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractUpdateUnitStatusParams(t, orig)
      },
      // Nuevas keywords
      {
        name: 'getAuditLogs',
        keywords: ['auditoria', 'audit', 'log', 'actividad', 'movimiento', 'cambio', 'modificacion', 'sistema', 'historial', 'registro', 'reciente', 'ultimo'],
        weight: 0,
        paramsExtractor: () => ({ limit: 10 })
      },
      {
        name: 'getCompanyExpenses',
        keywords: ['gasto', 'costo', 'egreso', 'mensual', 'gastamos', 'gasta', 'operativo', 'alquiler', 'servicio', 'sueldo'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getNetProfit',
        keywords: ['ganancia', 'neta', 'margen', 'utilidad', 'ingreso', 'egreso', 'balance', 'periodo', 'mes'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getCashSessions',
        keywords: ['caja', 'efectivo', 'balance caja', 'sesion', 'apertura', 'cierre', 'saldo'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getTasks',
        keywords: ['tarea', 'pendiente', 'hacer', 'asignado', 'vencimiento', 'completar', 'tarea'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getDocuments',
        keywords: ['documento', 'boleto', 'recibo', 'contrato', 'compraventa', 'generado', 'firmado', 'digital'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getInstallments',
        keywords: ['cuota', 'pagare', 'financiacion', 'adeudado', 'debe', 'vencer', 'vencido', 'pendiente pago', 'plan pago'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getUnitFinances',
        keywords: ['costo', 'vehiculo', 'finanza', 'margen', 'adquisicion', 'preparacion', 'costos auto', 'finanza unidad'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractUnitFinanceParams(t, orig)
      },
      {
        name: 'getUsers',
        keywords: ['usuario', 'vendedor', 'empleado', 'persona', 'staff', 'equipo', 'colaborador'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getTopSellers',
        keywords: ['ranking', 'top', 'mejor', 'vendedor', 'vendio mas', 'ranking venta'],
        weight: 0,
        paramsExtractor: () => ({})
      },
      {
        name: 'getDealFinances',
        keywords: ['finanza', 'finanzas', 'detalle financiero', 'saldo', 'pendiente', 'pago', 'pagos', 'anticipo', 'operacion', 'deal'],
        weight: 0,
        paramsExtractor: (t: string, orig: string) => this.extractDealFinancesParams(t, orig)
      },
    ];

    for (const action of actions) {
      action.weight = action.keywords.filter(kw => nText.includes(kw)).length;
    }

    const sorted = [...actions].sort((a, b) => b.weight - a.weight);
    const best = sorted[0];

    if (best && best.weight > 0) {
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
  // CAPA 3: EXTRACTORAS DE PARÁMETROS
  // ==============================
  private extractUnitSearchParams(text: string, original: string): any {
    const params: any = { limit: 15 };
    if (/automóvil|auto|carro|sedán|coupe|hatchback/i.test(text)) params.type = 'CAR';
    if (/motocicleta|moto|scooter/i.test(text)) params.type = 'MOTORCYCLE';
    if (/barco|lancha|nautica|yate|velero/i.test(text)) params.type = 'BOAT';

    const maxPrice = ArgSpanishUtils.parseArgentineAmount(text);
    if (maxPrice !== null) params.maxPriceArs = maxPrice;

    if (text.match(/(?:desde|más\s+de|mínimo\s+|desde\s+)\s*\d+(?:\.\d+)?\s*(palo|luca)/i)) {
      const minPrice = ArgSpanishUtils.parseArgentineAmount(text.replace(/(?:desde|más\s+de|mínimo\s+|hasta|máximo\s+|max\s+)/i, ''));
      if (minPrice !== null) params.minPriceArs = minPrice;
    }

    const yearMatch = text.match(/(?:del\s+)?año\s+(\d{4})|modelo\s+(\d{4})|año\s+(\d{2})/i);
    if (yearMatch) {
      let year = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3]);
      if (yearMatch[3] && year < 50) year += 2000;
      params.year = year;
    }

    const queryMatch = text.match(/(?:buscar|que\s+tenga\s+|con\s+|marca\s+|modelo\s+)\s+([^,.!?]+?)(?:\s+(?:con|de|hasta|desde|modelo|año)|$)/i);
    if (queryMatch && queryMatch[1].trim().length > 2) params.query = queryMatch[1].trim();

    if (text.includes('0km') || text.includes('nuevo')) { if (!params.status) params.status = 'AVAILABLE'; }
    return params;
  }

  private extractLeadSearchParams(text: string, original: string): any {
    const params: any = { limit: 15 };
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'lead');
    if (status) params.status = status;
    const dateRange = ArgSpanishUtils.parseRelativeDate(text);
    if (dateRange) params.dateRange = dateRange;
    const nameMatch = text.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|teléfono|email|de|$))/i);
    if (nameMatch) params.query = nameMatch[1].trim();
    const phoneMatch = text.match(/(?:teléfono|tel|celular|contacto)\s*:?\s*([\d\s\-]+)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/[\s\-]/g, '');
      if (/^\d{8,}$/.test(cleanPhone)) params.query = cleanPhone;
    }
    const emailMatch = text.match(/(?:email|e-mail|correo)\s*:?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) params.query = emailMatch[1];
    return params;
  }

  /** Extrae el identificador de una operación para getDealFinances.
   *  Acepta: ID explícito (#1234, op-1234, op_1234) o el nombre del cliente
   *  ("finanzas de la operación de Juan"). En el caso del nombre, se resuelve
   *  a ID en executeAction via búsqueda de deals. */
  private extractDealFinancesParams(text: string, original: string): any {
    const params: any = {};
    // ID explícito: "operación #1234", "deal op-1234", "operacion op_abc123"
    const idMatch = original.match(/(?:operaci[oó]n|operacion|venta|deal)\s*#?\s*([a-z0-9_-]{3,40})/i);
    if (idMatch && /^#?[a-z0-9_-]{3,}$/i.test(idMatch[1])) {
      params.dealId = idMatch[1].replace(/^#/, '');
    }
    // Nombre del cliente: "operación de Juan", "venta a María López"
    if (!params.dealId) {
      const nameMatch = original.match(/(?:operaci[oó]n|operacion|venta|deal)\s+(?:de|a|del)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]*)/);
      if (nameMatch) params.customerName = nameMatch[1].trim();
    }
    return params;
  }

  private extractCreateLeadParams(text: string, original: string): any {
    const params: any = {};
    const t = ArgSpanishUtils.normalize(text);

    const nameMatch = t.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|telefono|email|de|$)|$)/i);
    if (nameMatch) {
      const originalNameMatch = original.match(/(?:llamado|nombre\s+|cliente\s+(?:se\s+)?llama\s+)\s+([^,.!?]+?)(?:\s+(?:con|tel[eé]fono|email|de|$)|$)/i);
      params.name = originalNameMatch ? originalNameMatch[1].trim() : nameMatch[1].trim();
    }

    const phoneMatch = t.match(/(?:telefono|tel|celular|contacto)\s*:?\s*([\d\s\-]+)/i);
    if (phoneMatch) {
      const cleanPhone = phoneMatch[1].replace(/[\s\-]/g, '');
      if (/^\d{8,}$/.test(cleanPhone)) params.phone = cleanPhone;
    }

    const emailMatch = t.match(/(?:email|e-mail|correo)\s*:?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) params.email = emailMatch[1];

    const sourceMap: Record<string, string> = {
      instagram: 'INSTAGRAM', facebook: 'FACEBOOK_MARKETPLACE', referral: 'REFERRAL',
      'walk in': 'WALK_IN', 'entró caminando': 'WALK_IN',
      llamada: 'PHONE', 'llamada telefónica': 'PHONE',
      web: 'WEBSITE', 'sitio web': 'WEBSITE', whatsapp: 'WHATSAPP', wasap: 'WHATSAPP'
    };
    for (const [key, value] of Object.entries(sourceMap)) {
      const normalizedKey = ArgSpanishUtils.normalize(key);
      if (original.includes(key) || t.includes(normalizedKey)) { params.source = value; break; }
    }
    if (!params.source) params.source = 'OTHER';

    const notesMatch = text.match(/(?:notas?|observaciones?)\s*:?\s*(.+)/i);
    if (notesMatch) params.notes = notesMatch[1].trim();

    return params;
  }

  private extractUpdateLeadStatusParams(text: string, original: string): any {
    const params: any = {};
    const leadNameMatch = text.match(/(?:lead|cliente|prospecto)\s+(?:llamado\s+|de\s+nombre\s+|se\s+llama\s+)\s+([^,.!?]+?)(?:\s+(?:pasa\s+a\s+|estado\s+a\s+|actualiza\s+con\s+))/i);
    if (leadNameMatch) params.leadIdLookupName = leadNameMatch[1].trim();
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'lead');
    if (status) params.status = status;
    const notesMatch = text.match(/(?:notas?|observaciones?)\s*:?\s*(.+)/i);
    if (notesMatch) params.notes = notesMatch[1].trim();
    return params;
  }

  private extractUpdateUnitStatusParams(text: string, original: string): any {
    const params: any = {};
    const t = ArgSpanishUtils.normalize(text);
    const unitNameMatch = t.match(/(?:vehiculo|auto|unit)\s+(?:llamado|de\s+titulo|modelo)\s+([^,.!?]+?)(?:\s+(?:esta\s+ahora\s+pasa\s+a|estado\s+a|actualiza\s+con))/i);
    if (unitNameMatch) {
      const originalMatch = original.match(/(?:vehículo|auto|unit)\s+(?:llamado\s+|de\s+título\s+|modelo\s+)\s+([^,.!?]+?)(?:\s+(?:está|estado|pasa|actualiza))/i);
      params.unitIdLookupTitle = originalMatch ? originalMatch[1].trim() : unitNameMatch[1].trim();
    }
    const status = ArgSpanishUtils.mapStatusToPrismaStatus(text, 'unit');
    if (status) params.status = status;
    return params;
  }

  /** Extrae ID de vehículo para finanzas */
  private extractUnitFinanceParams(text: string, original: string): any {
    const params: any = {};
    // Buscar marca/modelo en el texto para hacer una búsqueda
    const brandMatch = original.match(/(?:toyota|ford|chevrolet|honda|fiat|volkswagen|peugeot|renault|nissan|kia|hyundai|citroen|jeep|bmw|audi|mercedes|ram)\s+([^,.!?\s]+)?/i);
    if (brandMatch) {
      params.query = brandMatch[0].trim();
    }
    return params;
  }

  // ==============================
  // CAPA 4: EJECUTOR DE ACCIONES
  // ==============================
  private async executeAction(action: keyof ReturnType<typeof buildCopilotTools>, params: Record<string, any>): Promise<any> {
    const tools = buildCopilotTools(this.companyId, this.userId);

    // Acciones que necesitan mapeo o lógica extra
    switch (action) {
      case 'getNetProfit': {
        const m = params.month || new Date().getMonth() + 1;
        const y = params.year || new Date().getFullYear();
        return await tools.getNetProfit.execute!({ month: m, year: y }, {} as any);
      }
      case 'searchLeads': {
        if (params.dateRange) {
          const allLeads = await tools.searchLeads.execute!(params, {} as any) as any;
          const filteredLeads = allLeads.leads.filter((lead: any) => {
            const leadDate = new Date(lead.createdAt);
            return leadDate >= params.dateRange!.gte && leadDate < params.dateRange!.lt;
          });
          return { ...allLeads, leads: filteredLeads, found: filteredLeads.length };
        }
        return await tools.searchLeads.execute!(params, {} as any);
      }
      case 'getUnitFinances': {
        if (params.query) {
          const searchResult = await tools.searchUnits.execute!({ query: params.query, limit: 1 }, {} as any) as any;
          if (searchResult.found > 0) {
            return await tools.getUnitFinances.execute!({ unitId: searchResult.units[0].id }, {} as any);
          }
          return { found: false, message: `Vehículo "${params.query}" no encontrado.` };
        }
        return await tools.getUnitFinances.execute!(params, {} as any);
      }
      case 'getLeadActivities': {
        // Multi-step: buscar lead por nombre, luego obtener sus actividades
        if (params.query) {
          const searchResult = await tools.searchLeads.execute!({ query: params.query, limit: 1 }, {} as any) as any;
          if (searchResult.found > 0) {
            return await tools.getLeadActivities.execute!({ leadId: searchResult.leads[0].id, limit: params.limit || 15 }, {} as any);
          }
          return { found: false, activities: [], message: `Lead "${params.query}" no encontrado.` };
        }
        return { found: false, activities: [], message: 'Especifique el nombre del lead para ver sus actividades.' };
      }
      case 'getDealFinances': {
        // Si vino un ID directo, usarlo.
        if (params.dealId) {
          return await tools.getDealFinances.execute!({ dealId: params.dealId }, {} as any);
        }
        // Si vino nombre del cliente, buscar su deal más reciente.
        if (params.customerName) {
          const dealsResult = await tools.getDeals.execute!({ limit: 20 }, {} as any) as any;
          if (dealsResult.found > 0) {
            const match = dealsResult.deals.find((d: any) =>
              String(d.cliente ?? '').toLowerCase().includes(params.customerName.toLowerCase())
            );
            if (match) {
              return await tools.getDealFinances.execute!({ dealId: match.id }, {} as any);
            }
          }
          return { found: false, message: `No se encontró ninguna operación para "${params.customerName}".` };
        }
        return { found: false, message: 'Especificá el número de operación (ej: "finanzas de la operación #1234") o el nombre del cliente.' };
      }
      default:
        return await (tools[action] as any).execute!(params, {} as any);
    }
  }

  // ==============================
  // CAPA 5: FORMATEADOR DE RESPUESTA
  // ==============================
  private formatResponse(result: any, action: string, params: Record<string, any>, originalMessage: string): string {
    switch (action) {
      case 'getDashboardStats': return ResponseTemplates.formatDashboardStats(result);
      case 'getDeals': return ResponseTemplates.formatDealsList(result.deals);
      case 'searchUnits': return ResponseTemplates.formatUnitsList(result.units, result.found, originalMessage);
      case 'searchLeads': return ResponseTemplates.formatLeadsList(result.leads, result.found, originalMessage);
      case 'createLead': return ResponseTemplates.formatCreateLead(result.lead || result);
      case 'updateLeadStatus': return ResponseTemplates.formatUpdateLeadStatus(result);
      case 'updateUnitStatus': return ResponseTemplates.formatUpdateUnitStatus(result);
      case 'getAuditLogs': return ResponseTemplates.formatAuditLogs(result);
      case 'getCompanyExpenses': return ResponseTemplates.formatCompanyExpenses(result);
      case 'getNetProfit': return ResponseTemplates.formatNetProfit(result);
      case 'getCashSessions': return ResponseTemplates.formatCashSessions(result);
      case 'getTasks': return ResponseTemplates.formatTasks(result);
      case 'getDocuments': return ResponseTemplates.formatDocuments(result);
      case 'getInstallments': return ResponseTemplates.formatInstallments(result);
      case 'getUnitFinances': return ResponseTemplates.formatUnitFinances(result);
      case 'getUsers': return ResponseTemplates.formatUsers(result);
      case 'getTopSellers': return ResponseTemplates.formatTopSellers(result);
      case 'getLeadActivities': return ResponseTemplates.formatLeadActivities(result);
      case 'getDealFinances': return ResponseTemplates.formatDealFinances(result);
      default: return JSON.stringify(result);
    }
  }

  // ==============================
  // MÉTODO DE INTEGRACIÓN
  // ==============================
  static async handleRequest(messages: any[], companyId: string, userId: string): Promise<string> {
    const agent = new RuleBasedAgent(companyId, userId);
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Formato de mensaje inválido');
    const lastUserMessageObj = messages.filter(m => m.role === 'user' || !m.role).pop() || messages[messages.length - 1];
    let lastUserMessage = '';
    if (typeof lastUserMessageObj?.content === 'string') lastUserMessage = lastUserMessageObj.content;
    else if (Array.isArray(lastUserMessageObj?.content)) lastUserMessage = lastUserMessageObj.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    else if (lastUserMessageObj?.parts) lastUserMessage = lastUserMessageObj.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    else if (typeof lastUserMessageObj?.text === 'string') lastUserMessage = lastUserMessageObj.text;
    if (!lastUserMessage.trim()) throw new Error('Mensaje vacío');
    return await agent.processMessage(lastUserMessage);
  }
}
