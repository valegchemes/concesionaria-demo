// lib/shared/pagination.ts
/**
 * Pagination utilities for list endpoints
 */

export interface PaginationParams {
  page?: string | number
  limit?: string | number
}

export interface PaginationResult {
  page: number
  limit: number
  skip: number
  take: number
}

/**
 * Parse and validate pagination params
 */
export function parsePagination(params: PaginationParams): PaginationResult {
  let page = Number(params.page) || 1
  let limit = Number(params.limit) || 20

  // Validate page
  page = Math.max(1, page)

  // Validate limit (min 1, max 100)
  limit = Math.max(1, Math.min(100, limit))

  // Calculate skip
  const skip = (page - 1) * limit

  return {
    page,
    limit,
    skip,
    take: limit,
  }
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  const totalPages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  }
}

/**
 * Validate that page is within valid range
 */
export function validatePageNumber(page: number, totalPages: number): boolean {
  return page >= 1 && page <= Math.max(1, totalPages)
}
