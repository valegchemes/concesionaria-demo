/**
 * Migration script: Encrypt existing Gmail OAuth tokens
 * 
 * Run with: npx tsx scripts/migrate-gmail-tokens.ts
 * 
 * This script:
 * 1. Finds all GmailConnection records with legacy plaintext tokens
 * 2. Encrypts them using AES-256-GCM
 * 3. Saves to new encrypted fields and clears legacy fields
 * 4. Logs progress
 */

import { PrismaClient } from '@prisma/client'
import { encrypt } from '../lib/shared/crypto'

const prisma = new PrismaClient()

async function migrate() {
  console.log('🔐 Starting Gmail tokens migration...')
  
  // Find all connections with legacy tokens but no encrypted tokens
  const connections = await prisma.gmailConnection.findMany({
    where: {
      accessTokenEnc: null,
      accessToken: { not: null },
    },
    select: {
      companyId: true,
      emailAddress: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiry: true,
    },
  })

  if (connections.length === 0) {
    console.log('✅ No legacy tokens found to migrate')
    return
  }

  console.log(`📋 Found ${connections.length} connections to migrate`)

  let success = 0
  let failed = 0

  for (const conn of connections) {
    try {
      if (!conn.accessToken || !conn.refreshToken) {
        console.warn(`⚠️  Skipping ${conn.companyId} - missing legacy tokens`)
        continue
      }

      console.log(`🔄 Migrating ${conn.companyId} (${conn.emailAddress})...`)

      const accessTokenEnc = encrypt(conn.accessToken)
      const refreshTokenEnc = encrypt(conn.refreshToken)

      await prisma.gmailConnection.update({
        where: { companyId: conn.companyId },
        data: {
          accessTokenEnc,
          refreshTokenEnc,
          // Clear legacy fields after successful encryption
          accessToken: null,
          refreshToken: null,
        },
      })

      console.log(`✅ Migrated ${conn.companyId}`)
      success++
    } catch (error) {
      console.error(`❌ Failed to migrate ${conn.companyId}:`, error)
      failed++
    }
  }

  console.log(`\n📊 Migration complete: ${success} success, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

migrate()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })