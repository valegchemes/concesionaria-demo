// lib/shared/logger.ts
// Structured logging with Pino (Server-side only)

// Simple console logger that works perfectly in Vercel Serverless/Edge
const logger = {
  info: (...args: any[]) => console.info('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', ...args)
    }
  },
  child: (options: { module: string }) => {
    return {
      info: (...args: any[]) => console.info(`[INFO][${options.module}]`, ...args),
      error: (...args: any[]) => console.error(`[ERROR][${options.module}]`, ...args),
      warn: (...args: any[]) => console.warn(`[WARN][${options.module}]`, ...args),
      debug: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG][${options.module}]`, ...args)
        }
      },
      child: () => logger
    }
  },
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
