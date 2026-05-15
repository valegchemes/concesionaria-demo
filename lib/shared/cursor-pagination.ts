/**
 * Cursor-based Pagination
 * Más eficiente que offset pagination para tablas grandes
 */

import { Prisma } from '@prisma/client'

export interface CursorPaginationParams {
  /** Cursor del último elemento de la página anterior */
  cursor?: string
  /** Número de elementos por página (default: 20, max: 100) */
  limit?: number
  /** Dirección de paginación (default: 'forward') */
  direction?: 'forward' | 'backward'
}

export interface CursorPaginationResult<T> {
  items: T[]
  pagination: {
    nextCursor: string | null
    prevCursor: string | null
    hasMore: boolean
    count: number
  }
}

/**
 * Parsea parámetros de cursor pagination desde query string
 */
export function parseCursorPagination(params: {
  cursor?: string | null
  limit?: string | null
  direction?: string | null
}): Required<CursorPaginationParams> {
  const DEFAULT_LIMIT = 20
  const MAX_LIMIT = 100

  const limit = params.limit
    ? Math.min(Math.max(1, parseInt(params.limit, 10)), MAX_LIMIT)
    : DEFAULT_LIMIT

  const direction = params.direction === 'backward' ? 'backward' : 'forward'

  return {
    cursor: params.cursor || undefined,
    limit,
    direction,
  }
}

/**
 * Construye opciones de Prisma para cursor pagination
 * 
 * @example
 * const options = buildCursorPaginationOptions({
 *   cursor: 'clx123abc',
 *   limit: 20,
 *   direction: 'forward',
 * })
 * 
 * const items = await prisma.unit.findMany({
 *   ...options,
 *   where: { companyId },
 *   orderBy: { createdAt: 'desc' },
 * })
 */
export function buildCursorPaginationOptions(
  params: CursorPaginationParams
): {
  take: number
  skip?: number
  cursor?: { id: string }
} {
  const { cursor, limit = 20, direction = 'forward' } = params

  // Pedir 1 elemento extra para detectar si hay más páginas
  const take = direction === 'forward' ? limit + 1 : -(limit + 1)

  if (!cursor) {
    return { take }
  }

  return {
    take,
    skip: 1, // Saltar el cursor actual
    cursor: { id: cursor },
  }
}

/**
 * Procesa resultados de cursor pagination
 * Extrae cursors y detecta si hay más páginas
 */
export function processCursorPaginationResults<T extends { id: string }>(
  items: T[],
  params: CursorPaginationParams
): CursorPaginationResult<T> {
  const { limit = 20, direction = 'forward' } = params

  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, limit) : items

  const nextCursor =
    hasMore && direction === 'forward' && resultItems.length > 0
      ? resultItems[resultItems.length - 1].id
      : null

  const prevCursor =
    hasMore && direction === 'backward' && resultItems.length > 0
      ? resultItems[0].id
      : null

  return {
    items: resultItems,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      count: resultItems.length,
    },
  }
}

/**
 * Helper completo para cursor pagination
 * Combina parsing, query y procesamiento
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const { searchParams } = new URL(request.url)
 *   
 *   const result = await cursorPaginate({
 *     params: {
 *       cursor: searchParams.get('cursor'),
 *       limit: searchParams.get('limit'),
 *     },
 *     query: async (options) => {
 *       return prisma.auditLog.findMany({
 *         ...options,
 *         where: { companyId },
 *         orderBy: { createdAt: 'desc' },
 *       })
 *     },
 *   })
 *   
 *   return NextResponse.json(result)
 * }
 */
export async function cursorPaginate<T extends { id: string }>(config: {
  params: {
    cursor?: string | null
    limit?: string | null
    direction?: string | null
  }
  query: (options: ReturnType<typeof buildCursorPaginationOptions>) => Promise<T[]>
}): Promise<CursorPaginationResult<T>> {
  const paginationParams = parseCursorPagination(config.params)
  const queryOptions = buildCursorPaginationOptions(paginationParams)
  const items = await config.query(queryOptions)
  return processCursorPaginationResults(items, paginationParams)
}
