/**
 * Prisma Client para Edge Runtime
 * - Usa @prisma/adapter-neon para conexión sin WebSocket
 * - Optimizado para entornos serverless (Vercel Edge)
 * - Connection pooling automático
 * - No requiere módulos nativos de Node.js
 */

import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient, Prisma } from '@prisma/client'
import { createLogger } from '@/lib/shared/logger'

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

interface EdgePrismaConfig {
  connectionString: string
  maxConnections?: number
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
    return baseUrl.replace(/:\d+\//, ':6543/')
  }

  return baseUrl
}

// ============================================================================
// PATRÓN SINGLETON PARA EDGE
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __edgePrisma: PrismaClient<Prisma.PrismaClientOptions, never> | undefined
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
 * Prisma Client singleton para Edge Runtime
 * Usa variable global para evitar múltiples instancias en hot reload
 */
export const prismaEdge = globalThis.__edgePrisma ?? createEdgePrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__edgePrisma = prismaEdge
}

// ============================================================================
// UTILIDADES DE BASE DE DATOS PARA EDGE
// ============================================================================

/**
 * Ejecuta una transacción con manejo de errores optimizado para Edge
 */
export async function withEdgeTransaction<T>(
  operations: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await prismaEdge.$transaction(operations, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    })
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
    const pool = prismaEdge._engine?.config?.adapter?.pool as Pool | undefined
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
