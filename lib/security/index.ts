// Security library public API
// Re-exports from individual modules to provide a unified public API

// Middleware exports
export {
  applyRateLimiting,
  validateCsrfMiddleware,
  addSecurityHeaders,
  addCsrfToken,
  generateCsrfToken,
  validateCsrfToken,
  generateNonce,
  RATE_LIMITS,
  STRICT_RATE_LIMITS,
  getSecurityRequestIdentifier,
  logSecurityEvent,
  logAuthFailure,
  logRateLimitExceeded,
  logCsrfInvalid,
  logValidationFailure,
  logSuspiciousInput,
} from './middleware'

// Validation exports
export {
  validateRequest,
  CommonSchemas,
  sanitizeHtml,
  sanitizeForLog,
  detectSuspiciousInput,
} from './validation'

// Wrapper exports
export {
  createSecureRoute,
  withAuth,
  withPermission,
  withRole,
  withRateLimit,
  withCsrfProtection,
  withoutCsrf,
  withoutRateLimit,
  publicRoute,
  strictRoute,
  adminRoute,
  billingRoute,
  webhookRoute,
} from './wrapper'

// Environment validation
export { validateEnvironment, validateEnvironmentAtStartup, validateEnvironmentNonFatal } from './validate-env'

// Types
export type { SecurityConfig } from './middleware'
export type { ValidatedEnv } from './validate-env'