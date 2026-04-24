/**
 * Enterprise Logger con Pino
 * - Logging estructurado JSON para Vercel
 * - Niveles de log configurables
 * - Contexto de módulo enriquecido
 * - Compatible con Edge Runtime
 */

import pino from 'pino'

// ============================================================================
// TIPOS ESTRUCTURADOS (sin 'any')
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'trace'

interface LogContext {
  [key: string]: string | number | boolean | object | undefined | null
}

interface LoggerOptions {
  module: string
  companyId?: string
  userId?: string
  requestId?: string
}

interface LogEntry {
  level: LogLevel
  time: string
  msg: string
  module: string
  pid: number
  hostname: string
  context?: LogContext
  error?: Error
}

// ============================================================================
// CONFIGURACIÓN DE PINO
// ============================================================================

const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 
                  (process.env.NODE_ENV === 'development' ? 'debug' : 'info')

const IS_EDGE_RUNTIME = typeof process === 'undefined' || process.version === undefined

/**
 * Crea la configuración base de Pino según el entorno
 */
function createPinoConfig(): pino.LoggerOptions {
  // Configuración base
  const baseConfig: pino.LoggerOptions = {
    level: LOG_LEVEL,
    base: {
      pid: IS_EDGE_RUNTIME ? 0 : process.pid,
      hostname: IS_EDGE_RUNTIME ? 'edge' : (process.env.VERCEL_REGION || 'unknown'),
      env: process.env.NODE_ENV || 'unknown',
      vercel: process.env.VERCEL_ENV || false,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
      bindings: (bindings: pino.Bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
      log: (obj: Record<string, unknown>) => {
        // Formatear errores para mejor legibilidad
        if (obj.err instanceof Error) {
          return {
            ...obj,
            error: {
              message: obj.err.message,
              stack: process.env.NODE_ENV === 'development' ? obj.err.stack : undefined,
              name: obj.err.name,
            },
          }
        }
        return obj
      },
    },
  }

  // En desarrollo, usar pretty print
  if (process.env.NODE_ENV === 'development' && !IS_EDGE_RUNTIME) {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          messageFormat: '[{module}] {msg}',
        },
      },
    }
  }

  return baseConfig
}

// ============================================================================
// LOGGER GLOBAL
// ============================================================================

const rootLogger = pino(createPinoConfig())

// ============================================================================
// LOGGER CON CONTEXTO DE MÓDULO
// ============================================================================

export class ModuleLogger {
  private logger: pino.Logger
  private module: string

  constructor(options: LoggerOptions) {
    this.module = options.module
    this.logger = rootLogger.child({
      module: options.module,
      companyId: options.companyId,
      userId: options.userId,
      requestId: options.requestId,
    })
  }

  /**
   * Log de nivel trace (muy detallado)
   */
  trace(context: LogContext, message: string): void {
    this.logger.trace({ ...context, module: this.module }, message)
  }

  /**
   * Log de nivel debug (diagnóstico)
   */
  debug(context: LogContext, message: string): void {
    this.logger.debug({ ...context, module: this.module }, message)
  }

  /**
   * Log de nivel info (informativo)
   */
  info(context: LogContext, message: string): void {
    this.logger.info({ ...context, module: this.module }, message)
  }

  /**
   * Log de nivel warn (advertencia)
   */
  warn(context: LogContext, message: string): void {
    this.logger.warn({ ...context, module: this.module }, message)
  }

  /**
   * Log de nivel error (error)
   */
  error(context: LogContext, message: string): void {
    this.logger.error({ ...context, module: this.module }, message)
  }

  /**
   * Log de nivel fatal (crítico)
   */
  fatal(context: LogContext, message: string): void {
    this.logger.fatal({ ...context, module: this.module }, message)
  }

  /**
   * Crea un child logger con contexto adicional
   */
  child(additionalContext: LogContext): ModuleLogger {
    return new ModuleLogger({
      module: this.module,
      ...additionalContext,
    })
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Crea un logger con contexto de módulo
 * @param moduleName - Nombre del módulo (ej: 'LeadService', 'AuthMiddleware')
 * @returns ModuleLogger instance
 * 
 * @example
 * const log = createLogger('LeadService')
 * log.info({ leadId: '123' }, 'Lead created')
 */
export function createLogger(moduleName: string): ModuleLogger {
  return new ModuleLogger({ module: moduleName })
}

// ============================================================================
// UTILIDADES DE LOGGING
// ============================================================================

/**
 * Mide el tiempo de ejecución de una función y loguea el resultado
 */
export async function logPerformance<T>(
  logger: ModuleLogger,
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await operation()
    logger.debug(
      { operation: operationName, duration: Date.now() - start },
      `${operationName} completed`
    )
    return result
  } catch (error) {
    logger.error(
      { 
        operation: operationName, 
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      },
      `${operationName} failed`
    )
    throw error
  }
}

/**
 * Crea un middleware de logging para API routes
 */
export function createRequestLogger(moduleName: string) {
  return {
    start: (requestId: string, path: string, method: string) => {
      const logger = createLogger(moduleName)
      logger.debug({ requestId, path, method }, 'Request started')
      return { logger, startTime: Date.now() }
    },
    end: (
      ctx: { logger: ModuleLogger; startTime: number },
      requestId: string,
      statusCode: number
    ) => {
      ctx.logger.debug(
        { 
          requestId, 
          statusCode, 
          duration: Date.now() - ctx.startTime 
        },
        'Request completed'
      )
    },
    error: (
      ctx: { logger: ModuleLogger; startTime: number },
      requestId: string,
      error: Error
    ) => {
      ctx.logger.error(
        { 
          requestId, 
          error: error.message,
          duration: Date.now() - ctx.startTime 
        },
        'Request failed'
      )
    },
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { rootLogger as logger }
export default createLogger

// Re-exports de tipos
export type { LogLevel, LogContext, LoggerOptions, LogEntry }
