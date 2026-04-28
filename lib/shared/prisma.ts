// lib/shared/prisma.ts
/**
 * Prisma client for database operations
 * Re-exports from lib/prisma.ts to avoid duplication
 *
 * prisma       — Cliente con Tenant Isolation (uso general en API routes)
 * prismaBypass — Cliente sin filtros de tenant (scripts internos, migraciones)
 */

export { prisma, prismaBypass, withTransaction, default } from '@/lib/prisma'