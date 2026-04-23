// lib/shared/errors.ts
// Custom error classes for consistent error handling

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = "AppError"
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

/**
 * 400 Bad Request - Invalid input/data
 */
export class ValidationError extends AppError {
  constructor(message: string, public details?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR")
    this.name = "ValidationError"
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED")
    this.name = "UnauthorizedError"
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

/**
 * 403 Forbidden - User lacks permission
 */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to access this resource") {
    super(message, 403, "FORBIDDEN")
    this.name = "ForbiddenError"
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`
    super(message, 404, "NOT_FOUND")
    this.name = "NotFoundError"
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT")
    this.name = "ConflictError"
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429, "RATE_LIMIT_EXCEEDED")
    this.name = "RateLimitError"
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred") {
    super(message, 500, "INTERNAL_SERVER_ERROR")
    this.name = "InternalServerError"
    Object.setPrototypeOf(this, InternalServerError.prototype)
  }
}

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode
  }
  return 500
}

/**
 * Get error response object
 */
export function getErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code,
      ...(error instanceof ValidationError && { details: error.details }),
    }
  }

  // Fallback for unknown errors
  const message = error instanceof Error ? error.message : "An unknown error occurred"
  return {
    error: message,
    code: "INTERNAL_SERVER_ERROR",
  }
}
