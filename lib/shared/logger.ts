/**
 * Universal Logger
 * - En browser: usa console (sin dependencias)
 * - En server/edge: usa pino para logs estructurados
 * - Seguro para importar en cualquier contexto (client, server, edge)
 * - Redacta automáticamente datos sensibles (passwords, tokens, etc.)
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
// REDACTOR DE DATOS SENSIBLES
// ============================================================================

/**
 * Palabras clave que indican datos sensibles
 * Se buscan en los nombres de las propiedades (case-insensitive)
 */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'auth',
  'cookie',
  'session',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'social_security',
  'pin',
  'privatekey',
  'private_key',
  'encryptionkey',
  'encryption_key',
]

/**
 * Redacta datos sensibles de un objeto recursivamente
 */
function redactSensitiveData(obj: unknown, depth = 0): unknown {
  // Prevenir recursión infinita
  if (depth > 10) return '[MAX_DEPTH]'

  // Tipos primitivos: retornar tal cual
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  // Arrays: redactar cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1))
  }

  // Objetos: redactar propiedades sensibles
  const redacted: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase()
    
    // Verificar si la key contiene palabras sensibles
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => 
      keyLower.includes(sensitiveKey)
    )

    if (isSensitive) {
      // Redactar pero mantener tipo y longitud aproximada
      if (typeof value === 'string') {
        redacted[key] = value.length > 0 ? `[REDACTED:${value.length}]` : '[REDACTED]'
      } else {
        redacted[key] = '[REDACTED]'
      }
    } else {
      // Recursivamente redactar objetos anidados
      redacted[key] = redactSensitiveData(value, depth + 1)
    }
  }

  return redacted
}

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
 * Redacta automáticamente datos sensibles
 */
function createBrowserLogger(options: LoggerOptions): ModuleLogger {
  const prefix = `[${options.module}]`

  const make = (level: LogLevel, consoleFn: (...args: unknown[]) => void) =>
    (ctx: LogContext, msg: string) => {
      // Redactar contexto antes de loguear
      const safeCtx = redactSensitiveData(ctx)
      consoleFn(prefix, msg, safeCtx)
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
      // Serializers personalizados para redactar datos sensibles
      serializers: {
        ...pino.stdSerializers,
        // Redactar errores (pueden contener datos sensibles en message/stack)
        err: (err: Error) => {
          const serialized = pino.stdSerializers.err(err)
          return redactSensitiveData(serialized)
        },
        // Redactar requests HTTP
        req: (req: unknown) => {
          const serialized = pino.stdSerializers.req(req)
          return redactSensitiveData(serialized)
        },
        // Redactar responses HTTP
        res: (res: unknown) => {
          const serialized = pino.stdSerializers.res(res)
          return redactSensitiveData(serialized)
        },
      },
      // Hook para redactar todos los contextos
      hooks: {
        logMethod(args: unknown[], method: (...args: unknown[]) => void) {
          // args[0] es el contexto, args[1] es el mensaje
          if (args.length >= 2 && typeof args[0] === 'object') {
            args[0] = redactSensitiveData(args[0])
          }
          method.apply(this, args)
        },
      },
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
