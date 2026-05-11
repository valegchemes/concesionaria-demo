// lib/shared/api-response.ts
// Consistent API response formatting

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError, isAppError, getErrorResponse, getErrorStatusCode } from './errors'
import { createLogger } from './logger'
import { Prisma } from '@prisma/client'

const log = createLogger('APIResponse')

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: Record<string, unknown>
  }
  meta?: {
    timestamp: string
    path?: string
  }
}

/**
 * Success response
 */
export function successResponse<T>(data: T, statusCode = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    } as ApiResponse<T>,
    { status: statusCode }
  )
}

/**
 * Paginated response
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit)
  return NextResponse.json(
    {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 200 }
  )
}

/**
 * Error response
 */
export function errorResponse(
  error: unknown,
  context?: {
    path?: string
    method?: string
  }
) {
  let statusCode = 500
  let errorResponse: Record<string, unknown>

  // Handle custom app errors
  if (isAppError(error)) {
    statusCode = error.statusCode
    errorResponse = getErrorResponse(error)
    log.warn(
      {
        statusCode,
        error: error.message,
        path: context?.path,
      },
      `API error: ${error.code}`
    )
  }
  // Handle Zod validation errors
  else if (error instanceof ZodError) {
    statusCode = 400
    const fieldErrors: Record<string, string[]> = {}
    error.issues.forEach((err: any) => {
      const path = err.path.join('.')
      if (!fieldErrors[path]) {
        fieldErrors[path] = []
      }
      fieldErrors[path].push(err.message)
    })
    errorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: fieldErrors,
    }
    log.debug({ fieldErrors }, 'Validation error')
  }
  // Handle Prisma known errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const code = error.code
    if (code === 'P2025') {
      statusCode = 404
      errorResponse = { error: 'Recurso no encontrado', code: 'NOT_FOUND' }
    } else if (code === 'P2002') {
      statusCode = 409
      errorResponse = { error: 'Ya existe un registro con esos datos', code: 'CONFLICT' }
    } else if (code === 'P2003' || code === 'P2014') {
      statusCode = 400
      errorResponse = { error: 'Referencia inválida en los datos', code: 'BAD_REQUEST' }
    } else {
      statusCode = 500
      errorResponse = { error: 'Error de base de datos', code: 'DATABASE_ERROR' }
    }
    log.error({ prismaCode: code, meta: error.meta, path: context?.path }, `Prisma error ${code}`)
  }
  // Handle unknown errors
  else {
    statusCode = 500
    const message = error instanceof Error ? error.message : 'Unknown error'
    errorResponse = {
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: message }),
    }
    log.error(
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        path: context?.path,
      },
      'Unhandled error in API'
    )
  }

  return NextResponse.json(
    {
      success: false,
      ...errorResponse,
      meta: { timestamp: new Date().toISOString(), path: context?.path },
    } as ApiResponse<never>,
    { status: statusCode }
  )
}

/**
 * Wrap an API route handler with consistent error handling
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest, context: T) => Promise<Response>
) {
  return async (request: NextRequest, context: T) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return errorResponse(error, {
        path: request.nextUrl.pathname,
        method: request.method,
      })
    }
  }
}
