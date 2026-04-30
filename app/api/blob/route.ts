import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:Blob')

/**
 * Extrae userId de múltiples fuentes para máxima compatibilidad:
 * 1. Sesión de NextAuth (cookies) - método preferido
 * 2. Header x-user-id inyectado por middleware - fallback seguro
 *
 * Esto permite que uploads funcionen incluso cuando las cookies
 * no llegan correctamente (algunos proxies, mobile, etc.)
 */
async function resolveUserId(request: NextRequest): Promise<string | null> {
  // Método 1: Sesión normal via cookies
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      return session.user.id
    }
  } catch (sessionError) {
    log.debug({ error: String(sessionError) }, 'getServerSession failed, trying header fallback')
  }

  // Método 2: Header inyectado por middleware (más confiable en algunos flows)
  const userIdFromHeader = request.headers.get('x-user-id')
  if (userIdFromHeader) {
    log.debug({ userId: userIdFromHeader }, 'Using x-user-id header for auth')
    return userIdFromHeader
  }

  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate via session OR header fallback
        const userId = await resolveUserId(request)

        if (!userId) {
          log.warn({ pathname }, 'Blob upload rejected - no valid session or header')
          throw new Error('Unauthorized: No valid session or x-user-id header')
        }

        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/heic',
            'image/heif',
            'image/bmp',
            'image/tiff',
          ],
          maximumSizeInBytes: 5 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: userId,
          }),
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called via webhook from Vercel Blob servers
        log.info({ url: blob.url, userId: tokenPayload }, 'Upload completed via webhook')
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Blob upload error')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
