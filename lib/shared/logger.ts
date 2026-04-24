/**
 * Universal Logger
 * - En browser: usa console (sin dependencias)
 * - En server/edge: usa pino para logs estructurados
 * - Seguro para importar en cualquier contexto (client, server, edge)
 */

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

// Detectar entorno de manera segura
const isBrowser = typeof window !== 'undefined'
const isEdge = !isBrowser && typeof process === 'undefined'
const isServer = !isBrowser

// ============================================================================
// LOGGER UNIVERSAL
// ============================================================================

type ModuleLogger = {
  debug: (ctx: LogContext, msg: string) => void
  info: (ctx: LogContext, msg: string) => void
  warn: (ctx: LogContext, msg: string) => void
  error: (ctx: LogContext, msg: string) => void
  fatal: (ctx: LogContext, msg: string) => void
  trace: (ctx: LogContext, msg: string) => void
  child: (ctx: LogContext) => ModuleLogger
}

/**
 * Logger que usa console en browser y pino en server
 */
function createBrowserLogger(options: LoggerOptions): ModuleLogger {
  const prefix = `[${options.module}]`

  const make = (level: LogLevel, consoleFn: (...args: unknown[]) => void) =>
    (ctx: LogContext, msg: string) => {
      consoleFn(prefix, msg, ctx)
    }

  const logger: ModuleLogger = {
    trace: make('trace', console.debug),
    debug: make('debug', console.debug),
    info:  make('info',  console.info),
    warn:  make('warn',  console.warn),
    error: make('error', console.error),
    fatal: make('fatal', console.error),
    child: (_ctx: LogContext) => logger,
  }

  return logger
}

// Cache de loggers server-side (pino es pesado, no reinstanciar)
let pinoInstance: unknown = null

function getPinoLogger(options: LoggerOptions): ModuleLogger {
  try {
    // Importación dinámica para que no se incluya en el bundle del cliente
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require('pino')

    const logLevel = (() => {
      try {
        return process?.env?.LOG_LEVEL ?? 'info'
      } catch {
        return 'info'
      }
    })()

    const base = pino({
      level: logLevel,
      base: { module: options.module },
      timestamp: pino.stdTimeFunctions.isoTime,
    })

    const child = base.child({
      module: options.module,
      ...(options.companyId && { companyId: options.companyId }),
      ...(options.userId && { userId: options.userId }),
      ...(options.requestId && { requestId: options.requestId }),
    })

    return child as unknown as ModuleLogger
  } catch {
    // Si pino no está disponible (edge, etc), fallback a console
    return createBrowserLogger(options)
  }
}

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

export function createLogger(
  module: string,
  options?: Partial<Omit<LoggerOptions, 'module'>>
): ModuleLogger {
  const opts: LoggerOptions = { module, ...options }

  // En browser: siempre usar console
  if (isBrowser) {
    return createBrowserLogger(opts)
  }

  // En servidor: usar pino con require() para evitar que bundler lo incluya en cliente
  return getPinoLogger(opts)
}

// Export de tipo para uso externo
export type { ModuleLogger, LogContext, LoggerOptions }
