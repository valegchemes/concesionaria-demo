// lib/shared/prisma.ts
/**
 * Prisma client for database operations
 * Re-exports from lib/prisma.ts to avoid duplication
 */

export { prisma, withTransaction, default } from '@/lib/prisma'