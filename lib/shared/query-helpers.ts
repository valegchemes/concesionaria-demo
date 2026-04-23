// lib/shared/query-helpers.ts
/**
 * Query and filtering utilities
 */

export interface SearchOptions {
  query?: string
  limit?: number
}

export interface FilterOptions {
  [key: string]: string | number | boolean | undefined
}

/**
 * Sanitize search query (prevent injection)
 */
export function sanitizeQuery(query: string): string {
  return query
    .trim()
    .substring(0, 100) // Max 100 chars
    .replace(/[<>]/g, '') // Remove angle brackets
}

/**
 * Build filter object from query params
 */
export function buildFilterFromParams(params: Record<string, any>): FilterOptions {
  const filters: FilterOptions = {}

  // Status filter
  if (params.status && typeof params.status === 'string') {
    filters.status = params.status
  }

  // Type filter
  if (params.type && typeof params.type === 'string') {
    filters.type = params.type
  }

  // Assigned to filter
  if (params.assignedToId && typeof params.assignedToId === 'string') {
    filters.assignedToId = params.assignedToId
  }

  // Sold by filter
  if (params.soldById && typeof params.soldById === 'string') {
    filters.soldById = params.soldById
  }

  // Price range filters
  if (params.minPrice) {
    filters.minPrice = Number(params.minPrice) || undefined
  }

  if (params.maxPrice) {
    filters.maxPrice = Number(params.maxPrice) || undefined
  }

  // Remove undefined values
  Object.keys(filters).forEach(key => {
    if (filters[key] === undefined) {
      delete filters[key]
    }
  })

  return filters
}

/**
 * Extract and validate search query
 */
export function extractSearchQuery(params: Record<string, any>): string | undefined {
  const query = params.q || params.query

  if (!query || typeof query !== 'string') {
    return undefined
  }

  return sanitizeQuery(query)
}

/**
 * Check if value is a valid enum
 */
export function isValidEnum<T extends Record<string, any>>(
  value: any,
  enumObj: T
): value is T[keyof T] {
  return Object.values(enumObj).includes(value)
}
