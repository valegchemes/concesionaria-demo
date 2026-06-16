/**
 * cleanup-orphan-blobs.ts
 * 
 * Script para limpiar archivos huérfanos en Vercel Blob Storage.
 * 
 * UN HUÉRFANO es un archivo en Blob Storage que no está referenciado 
 * en la base de datos (UnitPhoto, DigitalDocument.metadata.url, etc.)
 * 
 * EJECUCIÓN:
 * npx tsx scripts/cleanup-orphan-blobs.ts
 * 
 * OPCIONES:
 * --dry-run   Muestra qué se borraría sin borrar nada
 * --prefix    Especifica un prefijo específico (ej: units/abc123/)
 * 
 * NOTAS:
 * - Este script usa Prisma directamente (bypass tenant isolation)
 * - Ejecutar fuera del horario pico para evitar impacto en DB
 * - Los archivos se borran permanentemente - no hay undo
 */

import { PrismaClient } from '@prisma/client'
import { del, list } from '@vercel/blob'

// Prisma bypass client para este script
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

interface CleanupResult {
  totalBlobsScanned: number
  orphanBlobsFound: number
  orphanBlobsDeleted: number
  orphanBlobsFailed: number
  errors: string[]
  dryRun: boolean
}

async function getAllBlobUrlsFromDatabase(): Promise<Set<string>> {
  console.log('📊 Obteniendo todas las URLs de fotos y documentos de la DB...')
  
  const urls = new Set<string>()
  
  // UnitPhotos (photos de unidades)
  const photos = await prisma.unitPhoto.findMany({ select: { url: true } })
  for (const photo of photos) {
    if (photo.url) urls.add(photo.url)
  }
  console.log(`   - ${photos.length} fotos de unidades`)
  
  // DigitalDocuments metadata
  const docs = await prisma.digitalDocument.findMany({ 
    select: { metadata: true },
    // Nota: No filtramos por metadata != null porque Prisma no lo soporta
    // directamente en campos Json. Filtramos en código después.
  })
  for (const doc of docs) {
    const metadata = doc.metadata as { url?: string } | null
    if (metadata?.url) urls.add(metadata.url)
  }
  console.log(`   - ${docs.length} documentos digitales`)
  
  // Company logos
  const companies = await prisma.company.findMany({ 
    select: { logoUrl: true, signatureUrl: true }
  })
  for (const company of companies) {
    if (company.logoUrl) urls.add(company.logoUrl)
    if (company.signatureUrl) urls.add(company.signatureUrl)
  }
  console.log(`   - ${companies.length} logos/firmas de empresas`)
  
  // User avatars
  const users = await prisma.user.findMany({ select: { avatarUrl: true } })
  for (const user of users) {
    if (user.avatarUrl) urls.add(user.avatarUrl)
  }
  console.log(`   - ${users.length} avatares de usuarios`)
  
  console.log(`✅ Total de URLs en DB: ${urls.size}`)
  
  return urls
}

async function cleanupOrphanBlobs(options: {
  dryRun?: boolean
  prefix?: string
}): Promise<CleanupResult> {
  const { dryRun = false, prefix } = options
  
  const result: CleanupResult = {
    totalBlobsScanned: 0,
    orphanBlobsFound: 0,
    orphanBlobsDeleted: 0,
    orphanBlobsFailed: 0,
    errors: [],
    dryRun,
  }
  
  if (dryRun) {
    console.log('\n🔍 MODO DRY-RUN - No se borrará nada\n')
  }
  
  // Obtener URLs de la DB
  const dbUrls = await getAllBlobUrlsFromDatabase()
  
  // Prefijos a escanear
  const prefixes = prefix 
    ? [prefix] 
    : ['units/', 'logos/', 'avatars/']
  
  console.log(`\n🔍 Escaneando blobs en: ${prefixes.join(', ')}`)
  
  for (const scanPrefix of prefixes) {
    console.log(`\n📁 Procesando prefijo: ${scanPrefix}`)
    
    try {
      const { blobs } = await list({ prefix: scanPrefix })
      for (const blob of blobs) {
        result.totalBlobsScanned++

        // Normalizar URL (remover trailing slashes, etc)
        const normalizedUrl = blob.url.replace(/\/$/, '')

        if (!dbUrls.has(normalizedUrl) && !dbUrls.has(blob.url)) {
          result.orphanBlobsFound++
          console.log(`   🗑️  Huérfano encontrado: ${blob.url}`)
          console.log(`      Tamaño: ${formatBytes(blob.size)}`)

          if (!dryRun) {
            try {
              await del(blob.url)
              result.orphanBlobsDeleted++
              console.log(`      ✅ Eliminado`)
            } catch (deleteError) {
              result.orphanBlobsFailed++
              const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError)
              result.errors.push(`Error deleting ${blob.url}: ${errorMsg}`)
              console.log(`      ❌ Error al eliminar: ${errorMsg}`)
            }
          } else {
            console.log(`      (dry-run: no eliminado)`)
          }
        }
      }
    } catch (listError) {
      const errorMsg = listError instanceof Error ? listError.message : String(listError)
      result.errors.push(`Error listing ${scanPrefix}: ${errorMsg}`)
      console.error(`❌ Error listando ${scanPrefix}: ${errorMsg}`)
    }
  }
  
  return result
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function main() {
  const args = process.argv.slice(2)
  
  const dryRun = args.includes('--dry-run')
  const prefixArg = args.find(arg => arg.startsWith('--prefix='))
  const prefix = prefixArg ? prefixArg.split('=')[1] : undefined
  
  console.log('🧹 INICIO DE LIMPIEZA DE BLOBS HUÉRFANOS')
  console.log('==========================================\n')
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL no está configurada')
    process.exit(1)
  }
  
  try {
    const result = await cleanupOrphanBlobs({ dryRun, prefix })
    
    console.log('\n\n📊 RESUMEN DE LIMPIEZA')
    console.log('==========================================')
    console.log(`📁 Blobs escaneados: ${result.totalBlobsScanned}`)
    console.log(`🔴 Huérfanos encontrados: ${result.orphanBlobsFound}`)
    console.log(`🟢 Huérfanos eliminados: ${result.orphanBlobsDeleted}`)
    console.log(`⚠️  Errores: ${result.orphanBlobsFailed}`)
    
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORES:')
      for (const error of result.errors) {
        console.log(`   - ${error}`)
      }
    }
    
    if (result.orphanBlobsFound === 0) {
      console.log('\n✅ No se encontraron archivos huérfanos')
    } else if (dryRun) {
      console.log('\n⚠️  MODO DRY-RUN: Ejecutar sin --dry-run para eliminar los archivos')
    } else {
      console.log('\n✅ LIMPIEZA COMPLETADA')
    }
    
  } catch (error) {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()