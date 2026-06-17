/**
 * Test rápido del agente: verifica que las detecciones de intención
 * funcionan con las queries que mencionó el usuario.
 * 
 * Ejecutar: npx tsx scratch/test-agent-intents.ts
 */

import { ArgSpanishUtils } from '../lib/ai/argSpanishUtils';

// Replicamos la lógica de detectIntent (patrones) y detectIntentByKeywordScore (keywords)
// para testearlas sin necesidad de instanciar RuleBasedAgent

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\sáéíóúñ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const queries = [
  // Las que pidió probar el usuario
  'Quiero ver el stock',
  'Decime los autos que hay',
  'Mostrame clientes nuevos',
  // Otras variaciones
  'Quiero ver el inventario',
  'Mostrame los vehículos disponibles',
  'Dame la lista de autos',
  '¿Qué autos tenés?',
  'Buscame un Toyota Corolla',
  'Necesito saber qué unidades hay en stock',
  'Pasame los clientes que no contactamos',
  '¿Hay leads nuevos?',
  'Dame los prospectos de esta semana',
  '¿Cuántas ventas tuvimos este mes?',
  'Mostrame las operaciones',
  '¿Cómo van las ventas?',
  'Dame el resumen del mes',
  'Crear un cliente llamado Juan Pérez',
  'Agregar lead Juan teléfono 1122334455',
  // Casos bordes
  'stock',
  'inventario',
  'clientes',
  'ventas',
];

interface IntentTest {
  patterns: RegExp[];
  action: string;
  weight: number;
}

interface KeywordAction {
  name: string;
  keywords: string[];
  strongKeywords: string[];
  weight: number;
}

// Patrones de searchUnits
const SEARCH_UNITS_PATTERNS: RegExp[] = [
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
];

// Patrones de searchLeads
const SEARCH_LEADS_PATTERNS: RegExp[] = [
  /^(?:cuántos?\s+|¿cuántos?\s+)?(?:leads?|prospectos?|clientes?)\s+(?:activos?|nuevos?|pendientes?|sin\s+contactar)/i,
  /^(?:qué\s+|¿qué\s+)?(?:leads?|prospectos?|clientes?)\s+(?:tienes?|hay|hay\s+disponibles?)/i,
  /^(?:buscar|mostrame?|muéstrame?)\s+(?:leads?|prospectos?|clientes?)/i,
  /^(?:quiero\s+)?(?:ver|conocer|saber)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?)/i,
  /^(?:dame|pasame|mostrame)\s+(?:los?\s+)?(?:leads?|clientes?|prospectos?|contactos?)/i,
  /(?:leads?|clientes?|prospectos?)\s+(?:nuevos?|activos?|pendientes?|sin\s+contactar)/i,
  /(?:clientes?|prospectos?)\s+(?:que\s+)?(?:hay|tenemos|tienen|existen)/i,
  /(?:listado|lista)\s+(?:de\s+)?(?:leads?|clientes?|prospectos?)/i,
];

// Patrones de getDashboardStats
const DASHBOARD_PATTERNS: RegExp[] = [
  /^(?:cuántas?\s+)?(?:ventas?|ganancias?|operaciones?|facturación?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
  /^(?:estadísticas?|resumen|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
  /^(?:dame|pasame|mostrame)\s+(?:el\s+)?(?:resumen|estadísticas?|balance)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
  /^(?:cómo\s+|¿cómo\s+)?(?:vamos|estamos)\s+(?:este\s+mes|hoy)/i,
  /(?:resumen|balance|estadísticas?)\s+(?:del\s+)?(?:mes|negocio)/i,
  /(?:cómo\s+)?(?:vamos|estamos|anda)\s+(?:de\s+)?(?:ventas?|facturación?)/i,
];

// Patrones de getDeals
const DEALS_PATTERNS: RegExp[] = [
  /^(?:mostrame?|muéstrame?|ver|mostrar)\s+(?:las?\s+)?(?:ventas?|operaciones?|facturas?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual)/i,
  /^(?:cuánto\s+|¿cuánto\s+)?ganamos\s+(?:este\s+mes|mes\s+actual)/i,
  /^(?:cómo\s+|¿cómo\s+)?van\s+(?:las\s+)?(?:ventas?|operaciones?)/i,
  /(?:reporte|resumen|listado)\s+de\s+(?:ventas?|operaciones?)/i,
  /(?:ventas?|operaciones?)\s+(?:del\s+)?(?:este\s+mes|mes\s+actual|reciente)/i,
];

// Patrones de createLead
const CREATE_LEAD_PATTERNS: RegExp[] = [
  /^(?:crear|agregar|dar\s+de\s+alta|registrar|cargar|ingresar)\s+(?:un\s+)?(?:nuevo\s+)?(?:lead|cliente|prospecto)/i,
  /(?:necesito|quiero)\s+(?:crear|agregar|registrar|dar\s+de\s+alta)\s+(?:un\s+)?(?:cliente|lead|prospecto)/i,
  /(?:crear|agregar|registrar)\s+(?:un\s+)?(?:nuevo\s+)?(?:contacto|cliente|lead)/i,
];

// Keywords & strong keywords
const KEYWORDS: Record<string, { keywords: string[]; strong: string[] }> = {
  searchUnits: {
    keywords: ['auto', 'vehiculo', 'unidad', '0km', 'usado', 'nuevo', 'stock', 'inventario', 'catalogo', 'disponible', 'marca', 'modelo', 'precio', 'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame', 'quiero', 'necesito', 'listado', 'lista', 'hay', 'tiene', 'tenemos'],
    strong: ['stock', 'inventario', 'catalogo', 'disponible', '0km', 'listado'],
  },
  searchLeads: {
    keywords: ['lead', 'cliente', 'prospecto', 'contacto', 'llamado', 'persona', 'comprador', 'interesado', 'nuevo', 'activos', 'pendiente', 'ver', 'mostrar', 'mostrame', 'decime', 'dame', 'pasame', 'quiero', 'necesito', 'hay', 'tenemos'],
    strong: ['lead', 'prospecto', 'cliente'],
  },
  getDashboardStats: {
    keywords: ['estadistica', 'resumen', 'balance', 'reporte', 'kpi', 'indicador', 'cifra', 'numero', 'venta', 'ganancia', 'facturacion', 'operacion', 'ingreso', 'concesionaria', 'negocio', 'mes', 'resultado', 'vamos', 'estamos'],
    strong: ['estadistica', 'resumen', 'balance', 'kpi', 'indicador', 'reporte'],
  },
  getDeals: {
    keywords: ['operacion', 'venta', 'ventas', 'negocio', 'cerrado', 'entregado', 'factura', 'ingreso', 'ganancia', 'facturacion', 'vendimos', 'entregamos', 'ver', 'mostrar', 'mostrame', 'dame', 'pasame', 'decime', 'reciente', 'listado'],
    strong: ['operacion', 'factura'],
  },
  createLead: {
    keywords: ['crear', 'agregar', 'nuevo', 'alta', 'registrar', 'cargar', 'ingresar', 'dar de alta', 'cliente', 'lead', 'prospecto', 'contacto'],
    strong: ['crear', 'agregar', 'registrar', 'alta', 'ingresar', 'cargar'],
  },
};

interface IntentResult {
  method: 'pattern' | 'keyword' | 'none';
  action: string;
  score: number;
  hasStrong: boolean;
}

function detectIntent(text: string, original: string): IntentResult {
  const patternGroups: { action: string; patterns: RegExp[] }[] = [
    { action: 'getDashboardStats', patterns: DASHBOARD_PATTERNS },
    { action: 'getDeals', patterns: DEALS_PATTERNS },
    { action: 'searchUnits', patterns: SEARCH_UNITS_PATTERNS },
    { action: 'searchLeads', patterns: SEARCH_LEADS_PATTERNS },
    { action: 'createLead', patterns: CREATE_LEAD_PATTERNS },
  ];

  const searchText = original;
  for (const group of patternGroups) {
    for (const pattern of group.patterns) {
      if (pattern.test(searchText)) {
        return { method: 'pattern', action: group.action, score: 99, hasStrong: true };
      }
    }
  }

  return { method: 'none', action: '', score: 0, hasStrong: false };
}

function keywordScore(text: string): IntentResult {
  const nText = normalize(text);

  let bestAction = '';
  let bestScore = 0;
  let bestHasStrong = false;

  for (const [name, config] of Object.entries(KEYWORDS)) {
    const score = config.keywords.filter(kw => nText.includes(kw)).length;
    const hasStrong = config.strong.some(kw => nText.includes(kw));
    if (score > bestScore || (score === bestScore && hasStrong && !bestHasStrong)) {
      bestAction = name;
      bestScore = score;
      bestHasStrong = hasStrong;
    }
  }

  if (bestScore > 0) {
    const threshold = bestHasStrong ? 1 : 2;
    if (bestScore >= threshold) {
      return { method: 'keyword', action: bestAction, score: bestScore, hasStrong: bestHasStrong };
    }
  }

  return { method: 'none', action: '', score: 0, hasStrong: false };
}

// ─── Resultados ──────────────────────────────────────────────────────────────

console.log('═'.repeat(60));
console.log('🧪  TEST DE DETECCIÓN DE INTENCIÓN');
console.log('═'.repeat(60));
console.log();

for (const query of queries) {
  const n = ArgSpanishUtils.normalize(query);
  const patternResult = detectIntent(n, query);
  const keywordResult = keywordScore(query);

  const result = patternResult.method === 'pattern' ? patternResult : keywordResult;

  const status = result.method === 'none' ? '❌ NO DETECTADA' : '✅';
  const actionLabel = result.action ? result.action.padEnd(22) : '';
  const methodLabel = result.method === 'pattern' ? '(pattern)' : result.method === 'keyword' ? `(keyword, score:${result.score}, strong:${result.hasStrong})` : '';

  console.log(`${status}  ${query.padEnd(45)} → ${actionLabel} ${methodLabel}`);
}

console.log();
console.log('═'.repeat(60));
console.log('KEYWORD SCORING - DETALLE');
console.log('═'.repeat(60));
console.log();

for (const query of queries) {
  const n = normalize(query);
  const results: { name: string; score: number; hasStrong: boolean }[] = [];

  for (const [name, config] of Object.entries(KEYWORDS)) {
    const score = config.keywords.filter(kw => n.includes(kw)).length;
    const hasStrong = config.strong.some(kw => n.includes(kw));
    if (score > 0) results.push({ name, score, hasStrong });
  }

  results.sort((a, b) => b.score - a.score);

  if (results.length > 0) {
    console.log(`📝 "${query}"`);
    for (const r of results) {
      const threshold = r.hasStrong ? 1 : 2;
      const passes = r.score >= threshold;
      console.log(`   ${r.name.padEnd(22)} score:${r.score}  strong:${r.hasStrong}  threshold:${threshold}  ${passes ? '✅ PASA' : '❌ NO PASA'}`);
    }
    console.log();
  }
}
