import { z } from 'zod'
import { NextRequest } from 'next/server'
import { logValidationFailure, logSuspiciousInput } from './middleware'

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

export const CommonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().uuid('ID inválido'),
  }),

  // Search query
  search: z.object({
    q: z.string().max(100).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  // Date range
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).refine(
    (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
    { message: 'Fecha desde debe ser anterior a fecha hasta', path: ['from'] }
  ),

  // ID array
  ids: z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
  }),
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: Response }> {
  try {
    let data: unknown

    if (['GET', 'HEAD', 'DELETE'].includes(request.method)) {
      // Validate query parameters
      const url = new URL(request.url)
      const params = Object.fromEntries(url.searchParams.entries())
      data = schema.parse(params)
    } else {
      // Validate body
      const contentType = request.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await request.json()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        data = Object.fromEntries(formData.entries())
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        data = Object.fromEntries(formData.entries())
      } else {
        data = {}
      }
    }

    const result = schema.safeParse(data)
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      const firstError = (Object.entries(fieldErrors)[0]?.[1] as string[] | undefined)?.[0] || 'Datos inválidos'

      return {
        success: false,
        error: new Response(
          JSON.stringify({
            error: 'Datos de entrada inválidos',
            code: 'VALIDATION_ERROR',
            details: fieldErrors,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    return {
      success: false,
      error: new Response(
        JSON.stringify({ error: 'Error procesando la solicitud', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizeForLog(input: string): string {
  if (typeof input !== 'string') return String(input)
  return input
    // Normalizar separadores a espacio (anti log-injection: evita forjar nuevas
    // líneas de log con CRLF).
    .replace(/[\r\n\t\v\f]/g, ' ')
    // Quitar caracteres de control C0/C1 (excepto los ya reemplazados arriba),
    // PERO conservar Unicode imprimible (acentos, ñ, emojis) que antes se borraba
    // con `[^\x20-\x7E]` — esto mutilaba nombres/direcciones en una app en español.
    // \p{C} cubre categorías "Other" (control, surrogate, etc.).
    .replace(/\p{C}/gu, '')
    .slice(0, 500)
}

export function detectSuspiciousInput(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /drop\s+database/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i,
    /exec\s*\(/i,
    /eval\(/i,
    /expression\(/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(input))
}

export function validateAndSanitize<T>(
  data: unknown,
  schema: z.ZodSchema
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false, errors: result.error }
  }
  return { success: true, data: result.data }
}

// ============================================================================
// REQUEST VALIDATION HELPER
// La función validateRequest está definida una sola vez arriba (línea 47).
// El duplicado de abajo ha sido eliminado.
// validateAndSanitize se mantiene como helper adicional.
// ============================================================================