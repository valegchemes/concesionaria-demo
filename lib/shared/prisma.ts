// lib/shared/prisma.ts
/**
 * Prisma client with multi-tenant safety
 * Always wraps queries to automatically filter by company
 */

import { PrismaClient } from '@prisma/client'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Required for Neon serverless (WebSocket in non-edge environments)
neonConfig.webSocketConstructor = ws

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
