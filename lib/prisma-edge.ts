/**
 * Prisma Client para Edge Runtime
 * - Usa @prisma/adapter-neon para conexión sin WebSocket
 * - Optimizado para entornos serverless (Vercel Edge)
 * - Connection pooling automático
 * - Multi-Tenant Extension: inyección automática de companyId (igual que lib/prisma.ts)
 * - No requiere módulos nativos de Node.js
 */

import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient, Prisma } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'
import { getCurrentTenantId } from '@/lib/shared/tenant'
import { ForbiddenError } from '@/lib/shared/errors'

const log = createLogger('PrismaEdge')

// ============================================================================
// TIPOS ESTRUCTURADOS
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
// CONFIGURACIÓN DE NEON/POOL
// ============================================================================

/**
 * Obtiene la URL de conexión optimizada para Edge
 * Usa el pooler de Supabase (puerto 6543) automáticamente
 */
function getEdgeConnectionString(): string {
  const baseUrl = process.env.DATABASE_URL

  if (!baseUrl) {
    throw new Error('DATABASE_URL no está configurada')
  }

  // Siempre usar connection pooler en Edge
  if (baseUrl.includes('supabase.co') && !baseUrl.includes(':6543')) {
    // Replace port with pooler port using URL constructor
    try {
      const url = new URL(baseUrl);
      url.port = '6543';
      return url.toString();
    } catch {
      // Fallback: string replace
      return baseUrl.replace(':5432', ':6543').replace('5432', '6543');
    }
  }

  return baseUrl
}

// ============================================================================
// MODELOS CON TENANT ISOLATION (tienen campo companyId)
// ============================================================================

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
// TENANT EXTENSION (aislamiento multi-tenant)
// ============================================================================

type ModelName = string
type QueryArgs = Record<string, unknown>

function createTenantExtension(baseClient: PrismaClient) {
  return baseClient.$extends({
    name: 'tenant-isolation-edge',
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

          // Si no hay contexto de tenant, pasar directo
          if (!tenantId) {
            return query(args)
          }

          // OPERACIONES DE LECTURA: inyectar where.companyId
          const readOps = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'groupBy', 'aggregate']
          if (readOps.includes(operation)) {
            const currentArgs = args as { where?: QueryArgs }
            const currentWhere = currentArgs.where ?? {}

            if (currentWhere.companyId && currentWhere.companyId !== tenantId) {
              log.warn(
                { model, operation, tenantId, requestedCompanyId: currentWhere.companyId },
                '[TenantIsolation:Edge] Cross-tenant query bloqueada'
              )
              throw new ForbiddenError(
                `[TenantIsolation] Acceso denegado: el companyId de la query no coincide con el tenant actual`
              )
            }

            return query({
              ...args,
              where: { ...currentWhere, companyId: tenantId },
            })
          }

          // OPERACIONES DE ESCRITURA: inyectar data.companyId
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

          // OPERACIONES DE ESCRITURA ADICIONALES: inyectar companyId en WHERE
          const writeOps = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert']
          if (writeOps.includes(operation)) {
            const currentArgs = args as { where?: QueryArgs; data?: QueryArgs; create?: QueryArgs }
            const currentWhere = currentArgs.where ?? {}

            if (Object.keys(currentWhere).length > 0) {
              if (currentWhere.companyId && currentWhere.companyId !== tenantId) {
                log.warn(
                  { model, operation, tenantId, requestedCompanyId: currentWhere.companyId },
                  '[TenantIsolation:Edge] Cross-tenant write query bloqueada'
                )
                throw new ForbiddenError(
                  `[TenantIsolation] Acceso denegado: el companyId de la query no coincide con el tenant actual`
                )
              }
            }

            const extendedWhere = { ...currentWhere, companyId: tenantId }
            const extendedArgs: QueryArgs = { ...args, where: extendedWhere }

            if (operation === 'upsert') {
              const upsertArgs = currentArgs as { create?: QueryArgs }
              const createData = upsertArgs.create ?? {}
              return query({ ...extendedArgs, create: { ...createData, companyId: tenantId } })
            }

            return query(extendedArgs)
          }

          return query(args)
        },
      },
    },
  })
}

// ============================================================================
// PATRÓN SINGLETON PARA EDGE
// ============================================================================

declare global {
  var __edgePrisma: PrismaClient<Prisma.PrismaClientOptions, never> | undefined
  var __edgePrismaTenant: ReturnType<typeof createTenantExtension> | undefined
}

function createEdgePrismaClient(): PrismaClient {
  const connectionString = getEdgeConnectionString()
  const maxConnections = parseInt(process.env.DATABASE_POOL_SIZE ?? '10', 10)

  log.info(
    { maxConnections },
    'Inicializando Prisma Client para Edge Runtime'
  )

  // Crear pool de Neon con configuración optimizada
  const pool = new Pool({
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

  // Crear adapter Neon
  const adapter = new PrismaNeon(pool)

  // Crear Prisma Client con adapter
  const client = new PrismaClient({
    adapter: adapter as never,
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      ...(process.env.NODE_ENV === 'development' ? [{ emit: 'event' as const, level: 'query' as const }] : []),
    ],
  })

  // Event listeners
  client.$on('error' as never, (e: PrismaLogEvent) => {
    log.error({ message: e.message, target: e.target }, 'Prisma Edge Error')
  })

  client.$on('warn' as never, (e: PrismaLogEvent) => {
    log.warn({ message: e.message }, 'Prisma Edge Warning')
  })

  if (process.env.NODE_ENV === 'development') {
    client.$on('query' as never, (e: PrismaLogEvent) => {
      log.debug({ query: e.message, duration: e.duration }, 'Prisma Edge Query')
    })
  }

  return client
}

/**
 * Prisma Client base (sin tenant extension) — para migraciones y scripts
 */
export const prismaEdgeBypass = globalThis.__edgePrisma ?? createEdgePrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__edgePrisma = prismaEdgeBypass
}

/**
 * Prisma Client con tenant isolation — uso general en Edge Runtime
 */
export const prismaEdge = globalThis.__edgePrismaTenant ?? createTenantExtension(prismaEdgeBypass)

if (process.env.NODE_ENV !== 'production') {
  globalThis.__edgePrismaTenant = prismaEdge
}

// ============================================================================
// UTILIDADES DE BASE DE DATOS PARA EDGE
// ============================================================================

/**
 * Ejecuta una transacción con manejo de errores optimizado para Edge.
 * NOTA: Usa prismaEdgeBypass para compatibilidad de tipos con $transaction.
 * La tenant isolation se aplica por el cliente prismaEdge fuera de la transacción;
 * dentro del callback, usar el cliente global prismaEdge para queries con tenant.
 */
export async function withEdgeTransaction<T>(
  operations: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await prismaEdgeBypass.$transaction(operations, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    }) as T
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error en transacción Edge'
    )
    throw error
  }
}

/**
 * Verifica la conexión en Edge Runtime
 */
export async function checkEdgeConnection(): Promise<boolean> {
  try {
    await prismaEdge.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error de conexión Edge'
    )
    return false
  }
}

/**
 * Cierra el pool de conexiones de forma segura
 * IMPORTANTE: Llamar en handlers de Edge antes de retornar
 */
export async function closeEdgePool(): Promise<void> {
  try {
    // @ts-expect-error - El adapter expone el pool internamente
    const pool = prismaEdgeBypass._engine?.config?.adapter?.pool as Pool | undefined
    if (pool) {
      await pool.end()
      log.info({}, 'Edge pool cerrado correctamente')
    }
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error cerrando Edge pool'
    )
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { prismaEdge as prisma }
export default prismaEdge
