/**
 * Enterprise-grade Prisma Client Configuration
 * - Connection Pooling via Supabase (puerto 6543)
 - Patrón Singleton para prevenir múltiples instancias
 * - Logging estructurado con Pino
 * - Manejo de errores robusto
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('PrismaClient')

// ============================================================================
// TIPOS ESTRUCTURADOS (sin 'any')
// ============================================================================

type LogLevel = 'query' | 'info' | 'warn' | 'error'

interface PrismaLogEvent {
  timestamp: Date
  message: string
  target?: string
  duration?: number
  params?: string
}

// ============================================================================
// CONFIGURACIÓN DE CONNECTION POOLING
// ============================================================================

/**
 * Detecta si estamos en entorno serverless (Vercel)
 * y configura el connection pooling de Supabase
 */
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL no está configurada')
  }

  // En serverless (Vercel), usar Connection Pooler (puerto 6543)
  // Esto evita agotamiento de sockets en entornos serverless
  if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') {
    // Transformar URL para usar connection pooler si es Supabase
    if (baseUrl.includes('supabase.co') && !baseUrl.includes(':6543')) {
      const poolerUrl = baseUrl.replace(/:\d+\//, ':6543/')
      log.info({}, 'Usando Connection Pooler (puerto 6543) para entorno serverless')
      return poolerUrl
    }
  }

  return baseUrl
}

// ============================================================================
// CONFIGURACIÓN DE LOGGING
// ============================================================================

const logConfig: { emit: 'event'; level: LogLevel }[] = [
  { emit: 'event', level: 'query' },
  { emit: 'event', level: 'error' },
  { emit: 'event', level: 'warn' },
]

// En desarrollo, incluir queries
if (process.env.NODE_ENV === 'development') {
  logConfig.unshift({ emit: 'event', level: 'query' })
}

// ============================================================================
// PATRÓN SINGLETON
// ============================================================================

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined 
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl()
  
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: logConfig,
  })

  // Event listeners para logging estructurado
  client.$on('query' as never, (e: PrismaLogEvent) => {
    log.debug({
      query: e.message,
      duration: e.duration,
      params: e.params,
    }, 'Prisma Query')
  })

  client.$on('error' as never, (e: PrismaLogEvent) => {
    log.error({
      message: e.message,
      target: e.target,
    }, 'Prisma Error')
  })

  client.$on('warn' as never, (e: PrismaLogEvent) => {
    log.warn({
      message: e.message,
    }, 'Prisma Warning')
  })

  return client
}

// Exportar singleton
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Guardar en global para hot reload en desarrollo
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// ============================================================================
// UTILIDADES DE BASE DE DATOS
// ============================================================================

/**
 * Ejecuta una transacción con reintentos automáticos
 * Útil para operaciones críticas en entornos serverless
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    onRetry?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 100, onRetry } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      const err = error instanceof Error ? error : new Error(String(error))

      if (isLastAttempt) {
        log.error({ error: err, attempt }, 'Operación fallida después de reintentos')
        throw err
      }

      log.warn({ error: err.message, attempt }, 'Reintentando operación')
      
      if (onRetry) {
        onRetry(err, attempt)
      }

      await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw new Error('Unreachable')
}

/**
 * Ejecuta operaciones en transacción con manejo de errores
 */
export async function withTransaction<T>(
  operations: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return withRetry(() => prisma.$transaction(operations, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
  }))
}

/**
 * Verifica la conexión a la base de datos
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error de conexión a base de datos')
    return false
  }
}

/**
 * Cierra la conexión de Prisma de forma segura
 * Útil para graceful shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
  log.info({}, 'Prisma client desconectado')
}

export default prisma
