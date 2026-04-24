import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:Blob')

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate ONLY during token generation (browser request)
        const session = await getServerSession(authOptions)
        if (!session?.user) {
          throw new Error('Unauthorized')
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
            userId: session.user.id,
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
