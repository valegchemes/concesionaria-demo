'use server'

import { put } from '@vercel/blob'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('UploadAction')

export async function uploadImageServerAction(formData: FormData): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const file = formData.get('file') as File
  if (!file) {
    throw new Error('No file provided')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large')
  }

  try {
    const blob = await put(file.name, file, {
      access: 'public',
    })

    return blob.url
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Vercel Blob put error')
    throw new Error('Failed to upload image to storage')
  }
}
