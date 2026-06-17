// lib/ai/argSpanishUtils.ts
export class ArgSpanishUtils {
  /** Normaliza texto para matching robusto (elimina acentos, puntuación excesiva) */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Eliminar acentos
      .replace(/[^\w\sáéíóúñ]/g, ' ')   // Mantener letras básicas + ñ
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Detecta y convierte jerga argentina de montos a números */
  static parseArgentineAmount(text: string): number | null {
    // Patrones: "15 palos", "8 lucas", "medio palo", "1.5 palos"
    const amountMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(palo|palos|luca|lucas|millón|millones|mil)/i
    );
    if (!amountMatch) return null;

    const value = parseFloat(amountMatch[1]);
    const unit = amountMatch[2].toLowerCase();

    switch (unit) {
      case 'palo':
      case 'palos':
      case 'millón':
      case 'millones':
        return value * 1_000_000;
      case 'luca':
      case 'lucas':
      case 'mil':
        return value * 1_000;
      default:
        return null;
    }
  }

  /** Convierte expresiones de tiempo relativo a rangos de fecha */
  static parseRelativeDate(text: string): { gte: Date; lt: Date } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (text.includes('hoy')) {
      return { gte: today, lt: new Date(today.getTime() + 86_400_000) };
    }
    if (text.includes('ayer')) {
      const yesterday = new Date(today.getTime() - 86_400_000);
      return { gte: yesterday, lt: today };
    }
    if (text.includes('esta semana')) {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { gte: startOfWeek, lt: new Date(startOfWeek.getTime() + 7 * 86_400_000) };
    }
    if (text.includes('el mes pasado')) {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { gte: lastMonth, lt: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    if (text.includes('este mes')) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { gte: startOfMonth, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    return null;
  }

  /** Mapea términos de estado argentino a valores de Prisma */
  static mapStatusToPrismaStatus(input: string, type: 'unit' | 'lead'): string | null {
    const unitMap: Record<string, 'AVAILABLE' | 'IN_PREP' | 'RESERVED' | 'SOLD' | string[]> = {
      disponible: 'AVAILABLE',
      'en preparación': 'IN_PREP',
      preparándose: 'IN_PREP',
      reservado: 'RESERVED',
      vendido: 'SOLD',
      '0km': 'AVAILABLE', // En Argentina, 0km suele implicar disponible/nuevo
      nuevo: 'AVAILABLE',
      usado: ['RESERVED', 'SOLD'] // Ambiguo - requiere contexto adicional
    };

    const leadMap: Record<string, 'NEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'OFFER' | 'RESERVED' | 'SOLD' | 'LOST'> = {
      nuevo: 'NEW',
      contactado: 'CONTACTED',
      llamado: 'CONTACTED',
      'visita agendada': 'VISIT_SCHEDULED',
      negociación: 'OFFER',
      'en oferta': 'OFFER',
      reservado: 'RESERVED',
      vendido: 'SOLD',
      perdido: 'LOST',
      'sin respuesta': 'NEW' // Interpretación común en CRM
    };

    const map = type === 'unit' ? unitMap : leadMap;
    for (const [key, value] of Object.entries(map)) {
      if (input.includes(key)) return typeof value === 'string' ? value : value[0]; // Tomar primera opción si es array
    }
    return null;
  }

  /** Formatea números según locale es-AR (ej: 1500000 → "1.500.000") */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /** Formatea fechas en formato dd/mm/yyyy (es-AR) */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}