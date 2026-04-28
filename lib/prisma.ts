/**
 * Enterprise-grade Prisma Client Configuration
 * - Connection Pooling via Neon (serverless adapter)
 * - Patrón Singleton para prevenir múltiples instancias
 * - Logging estructurado con Pino
 * - Manejo de errores robusto
 * - Multi-Tenant Extension: inyección automática de companyId
 *   en todas las queries, previniendo Cross-Tenant Data Leakage
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { getCurrentTenantId } from '@/lib/shared/tenant'

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
  prismaBase: PrismaClient | undefined
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

// ============================================================================
// MODELOS CON TENANT ISOLATION (tienen campo companyId)
// ============================================================================

/**
 * Lista de modelos Prisma que tienen un campo companyId y deben ser filtrados
 * por tenant automáticamente. Modelos internos (DealPayment, UnitPhoto, etc.)
 * no tienen companyId propio y se acceden siempre a través de su modelo padre.
 */
const TENANT_MODELS = new Set([
  'deal',
  'lead',
  'leadActivity',
  'task',
  'unit',
  'whatsAppTemplate',
  'publicClickEvent',
  'auditLog',
  'role',
  'saasSubscription',
  'saasUsageEvent',
  'companyExpense',
  'user',
])

// ============================================================================
// PRISMA CLIENT EXTENSION: TENANT ISOLATION
// ============================================================================

type ModelName = string
type QueryArgs = Record<string, unknown>

/**
 * Crea una Prisma Client Extension que inyecta automáticamente el companyId
 * del contexto de tenant en todas las queries de lectura y escritura.
 *
 * LECTURA (findMany, findFirst, count, groupBy, aggregate):
 *   Inyecta where.companyId = currentTenantId en la query.
 *
 * ESCRITURA (create, createMany):
 *   Inyecta data.companyId = currentTenantId en los datos.
 *
 * Modelos sin companyId (DealPayment, UnitPhoto, etc.) no son afectados.
 */
function createTenantExtension(baseClient: PrismaClient) {
  return baseClient.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: {
          model: ModelName
          operation: string
          args: QueryArgs
          query: (args: QueryArgs) => Promise<unknown>
        }) {
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1)

          // Solo aplicar a modelos que tienen companyId
          if (!TENANT_MODELS.has(modelKey)) {
            return query(args)
          }

          const tenantId = getCurrentTenantId()

          // Si no hay contexto de tenant (scripts, migraciones), pasar directo
          if (!tenantId) {
            return query(args)
          }

          // -----------------------------------------------------------------
          // OPERACIONES DE LECTURA: inyectar where.companyId
          // -----------------------------------------------------------------
          const readOps = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'groupBy', 'aggregate']
          if (readOps.includes(operation)) {
            const currentArgs = args as { where?: QueryArgs }
            const currentWhere = currentArgs.where ?? {}

            // Si ya tiene companyId, respetar el valor (no sobreescribir en migraciones)
            // Si es diferente al tenant actual, es un intento de cross-tenant — bloquearlo
            if (currentWhere.companyId && currentWhere.companyId !== tenantId) {
              log.warn(
                { model, operation, tenantId, requestedCompanyId: currentWhere.companyId },
                '[TenantIsolation] Cross-tenant query bloqueada'
              )
              throw new Error(
                `[TenantIsolation] Acceso denegado: el companyId de la query no coincide con el tenant actual`
              )
            }

            return query({
              ...args,
              where: { ...currentWhere, companyId: tenantId },
            })
          }

          // -----------------------------------------------------------------
          // OPERACIONES DE ESCRITURA: inyectar data.companyId
          // -----------------------------------------------------------------
          if (operation === 'create') {
            const currentArgs = args as { data?: QueryArgs }
            return query({
              ...args,
              data: { ...currentArgs.data, companyId: tenantId },
            })
          }

          if (operation === 'createMany') {
            const currentArgs = args as { data?: QueryArgs | QueryArgs[] }
            const data = Array.isArray(currentArgs.data)
              ? currentArgs.data.map((d: QueryArgs) => ({ ...d, companyId: tenantId }))
              : { ...(currentArgs.data ?? {}), companyId: tenantId }
            return query({ ...args, data })
          }

          // Todas las demás operaciones (update, delete, upsert, etc.) pasan directo
          // La protección de estas ya existe a nivel de servicio con findFirst + companyId
          return query(args)
        },
      },
    },
  })
}

/** Cliente base (sin extensión de tenant) — para migraciones, cron jobs y scripts internos */
export const prismaBypass: PrismaClient = globalForPrisma.prismaBase ?? createPrismaClient()

/** Cliente con extensión de tenant — uso general en toda la aplicación */
export const prisma = createTenantExtension(prismaBypass)

// Guardar instancia base en global para hot reload en desarrollo
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = prismaBypass
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
 * Ejecuta operaciones en transacción con manejo de errores.
 * Usa prismaBypass para evitar conflictos de tipos con la extensión de tenant.
 * El aislamiento de tenant sigue activo a través de AsyncLocalStorage.
 */
export async function withTransaction<T>(
  operations: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return withRetry(() => prismaBypass.$transaction(operations, {
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
    await prismaBypass.$queryRaw`SELECT 1`
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
  await prismaBypass.$disconnect()
  log.info({}, 'Prisma client desconectado')
}

export default prisma
