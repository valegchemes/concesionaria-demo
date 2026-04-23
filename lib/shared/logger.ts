// lib/shared/logger.ts
// Structured logging with Pino (Server-side only)

// Check if we're on the server
const isServer = typeof window === 'undefined'

let logger: any

if (isServer) {
  // Dynamic import for server-side only
  const pino = require('pino')
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      env: process.env.NODE_ENV,
      service: "concesionaria-api",
    },
  },
  pino.transport({
    target: "pino-pretty",
    options: {
      colorize: process.env.NODE_ENV === "development",
      singleLine: false,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  }))
} else {
  // Browser fallback - simple console logger
  logger = {
    info: (...args: any[]) => console.log('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
    child: () => logger,
  }
}

/**
 * Create a child logger with a specific module name
 * @param moduleName - Name of the module (e.g., "LeadService", "AuthMiddleware")
 * @returns Child logger instance
 */
export function createLogger(moduleName: string) {
  return logger.child({ module: moduleName })
}

// Export base logger for global use
export default logger

// ============================================================================
// Log Levels
// ============================================================================

/**
 * Log levels in order of severity:
 * debug - Detailed diagnostic information
 * info  - General informational messages
 * warn  - Warning messages for potentially harmful situations
 * error - Error messages for problematic situations
 */

// ============================================================================
// Usage Examples
// ============================================================================

/*
// In a service/route:
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('LeadService')

export async function createLead(data) {
  log.info({ data }, 'Creating new lead')
  
  try {
    const lead = await db.lead.create({ data })
    log.info({ leadId: lead.id }, 'Lead created successfully')
    return lead
  } catch (error) {
    log.error({ error: error.message, data }, 'Failed to create lead')
    throw error
  }
}

// In middleware:
const log = createLogger('AuthMiddleware')
log.debug({ headers: req.headers }, 'Request received')
log.warn({ userId }, 'Multiple failed login attempts')
log.error({ error }, 'Unexpected error in middleware')
*/
