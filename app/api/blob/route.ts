import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { getCurrentUserFromHeaders, requireAuth } from '@/lib/shared/auth-helpers'

const log = createLogger('API:Blob')

/**
 * Extrae userId de múltiples fuentes para máxima compatibilidad:
 * 1. Sesión de NextAuth (cookies) - método preferido
 * 2. Header x-user-id inyectado por middleware - fallback seguro
 *
 * Esto permite que uploads funcionen incluso cuando las cookies
 * no llegan correctamente (algunos proxies, mobile, etc.)
 */
async function resolveCurrentUser(request: NextRequest): Promise<{ id: string; companyId: string } | null> {
  try {
    const session = await requireAuth()
    // requireAuth throws if not authenticated, so if we get here, we have a session
    // But we need to get the session data again since requireAuth doesn't return it
    const sessionData = await Promise.race([
      getServerSession(authOptions),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ])
    if (sessionData?.user) {
      return { id: sessionData.user.id, companyId: sessionData.user.companyId }
    }
  } catch {
    // Si no hay sesión normal, intentar con headers inyectados por middleware.
  }

  const headerUser = await getCurrentUserFromHeaders(request)
  if (!headerUser?.id || !headerUser?.companyId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: headerUser.id },
    select: { id: true, companyId: true, isActive: true, company: { select: { isActive: true } } },
  })

  if (!user?.isActive || !user.company?.isActive) {
    return null
  }

  return { id: user.id, companyId: user.companyId }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody
    const currentUser = await resolveCurrentUser(request)

    if (!currentUser?.id || !currentUser?.companyId) {
      log.warn({}, 'Blob upload rejected - no valid authenticated user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
          ],
          maximumSizeInBytes: 5 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: currentUser.id,
            companyId: currentUser.companyId,
          }),
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called via webhook from Vercel Blob servers
        let parsedPayload: Record<string, unknown> = {}
        try {
          if (typeof tokenPayload === 'string') {
            parsedPayload = JSON.parse(tokenPayload)
          }
        } catch {
          // ignore
        }
        log.info({ url: blob.url, tokenPayload: parsedPayload }, 'Upload completed via webhook')
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
